import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { fr } from 'date-fns/locale';
import { 
  CalendarIcon, ChevronLeft, ChevronRight, 
  AlertCircle, RefreshCw, History, Microscope 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';

// Types pour les analyses
interface SampleForm {
  id: string;
  form_id: string;
  report_title: string;
  site: string;
  created_at: string;
  status: string;
  bacteria_type: string;
  reading_date: string;
  reading_day: string;
  samples_count: number;
}

// Constantes pour les types de bactéries et leurs délais
const BACTERIA_TYPES = [
  { name: 'Entérobactéries', delay: '24h', color: 'bg-red-100 border-red-300 text-red-800' },
  { name: 'Levures/Moisissures', delay: '5j', color: 'bg-green-100 border-green-300 text-green-800' },
  { name: 'Listeria', delay: '48h', color: 'bg-purple-100 border-purple-300 text-purple-800' },
  { name: 'Coliformes totaux', delay: '48h', color: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
  { name: 'Staphylocoques', delay: '48h', color: 'bg-blue-100 border-blue-300 text-blue-800' },
];

// Jours de la semaine
const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const ReadingCalendarPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [readingForms, setReadingForms] = useState<Record<string, SampleForm[]>>({});
  const [loading, setLoading] = useState(true);
  const [calendarView, setCalendarView] = useState<'by-day' | 'by-bacteria'>('by-bacteria');

  // Effet pour calculer les jours de la semaine actuelle
  useEffect(() => {
    const today = new Date();
    const firstDayOfWeek = startOfWeek(
      currentWeek === 0 ? today : (
        currentWeek > 0 ? addWeeks(today, currentWeek) : subWeeks(today, Math.abs(currentWeek))
      ), 
      { weekStartsOn: 1 }
    );
    
    const days = WEEKDAYS.map((_, index) => addDays(firstDayOfWeek, index));
    setWeekDays(days);
    
    loadReadingForms();
  }, [currentWeek]);

  // Fonction pour charger les formulaires en attente de lecture
  const loadReadingForms = async () => {
    try {
      setLoading(true);
      
      // Requête pour obtenir tous les échantillons avec status = 'waiting_reading'
      const { data, error } = await supabase
        .from('samples')
        .select('*')
        .eq('status', 'waiting_reading');
        
      if (error) {
        console.error("Erreur lors du chargement des lectures en attente:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les lectures en attente",
          variant: "destructive"
        });
        setLoading(false);
        return;
      }
      
      // Grouper les échantillons par jour de lecture et par bactérie
      const formsByDay: Record<string, SampleForm[]> = {};
      
      // Créer une map pour regrouper les échantillons par form_id
      const formMap = new Map<string, SampleForm>();
      
      if (data && data.length > 0) {
        data.forEach(sample => {
          if (sample.form_id) {
            // Si ce form_id existe déjà dans la map, incrémenter le compteur d'échantillons
            if (formMap.has(sample.form_id)) {
              const existingForm = formMap.get(sample.form_id)!;
              existingForm.samples_count += 1;
            } else {
              // Sinon, créer une nouvelle entrée
              const bacteriaInfo = getBacteriaInfo(sample.analysis_type || 'Entérobactéries');
              const readingDay = sample.reading_day || 'Lundi';
              
              formMap.set(sample.form_id, {
                id: sample.id,
                form_id: sample.form_id,
                report_title: sample.report_title || `Analyse du ${format(new Date(sample.created_at), 'dd/MM/yyyy')}`,
                site: sample.site || '',
                created_at: sample.created_at,
                status: sample.status,
                bacteria_type: sample.analysis_type || 'Entérobactéries',
                reading_date: sample.reading_date || format(new Date(), 'yyyy-MM-dd'),
                reading_day: readingDay,
                samples_count: 1
              });
              
              // Initialiser le tableau pour ce jour s'il n'existe pas
              if (!formsByDay[readingDay]) {
                formsByDay[readingDay] = [];
              }
            }
          }
        });
        
        // Convertir la map en objet groupé par jour
        formMap.forEach(form => {
          if (!formsByDay[form.reading_day]) {
            formsByDay[form.reading_day] = [];
          }
          formsByDay[form.reading_day].push(form);
        });
      }
      
      setReadingForms(formsByDay);
      console.log("Formulaires en attente de lecture chargés:", formsByDay);
      
    } catch (error) {
      console.error("Erreur lors du chargement des lectures:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors du chargement des données",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Obtenir les informations sur une bactérie (couleur, délai)
  const getBacteriaInfo = (bacteriaName: string) => {
    const bacteria = BACTERIA_TYPES.find(b => b.name === bacteriaName);
    return bacteria || BACTERIA_TYPES[0]; // Par défaut Entérobactéries
  };

  // Changer de semaine
  const changeWeek = (direction: 'next' | 'prev') => {
    setCurrentWeek(prev => direction === 'next' ? prev + 1 : prev - 1);
  };

  // Revenir à la semaine actuelle
  const resetToCurrentWeek = () => {
    setCurrentWeek(0);
  };

  // Ouvrir un formulaire pour saisir les lectures
  const handleOpenForm = (form: SampleForm) => {
    navigate('/sample-entry', {
      state: {
        formId: form.form_id,
        isFromHistory: true,
        isReading: true,
        reportTitle: form.report_title,
        bacterie: form.bacteria_type
      }
    });
  };

  // Voir l'historique des formulaires
  const handleViewFormsHistory = () => {
    navigate('/forms-history');
  };

  // Obtenir les formulaires groupés par bactérie
  const getFormsByBacteria = () => {
    const formsByBacteria: Record<string, SampleForm[]> = {};
    
    // Initialiser les tableaux pour chaque type de bactérie
    BACTERIA_TYPES.forEach(bacteria => {
      formsByBacteria[bacteria.name] = [];
    });
    
    // Parcourir tous les jours et regrouper par bactérie
    Object.values(readingForms).forEach(dayForms => {
      dayForms.forEach(form => {
        if (!formsByBacteria[form.bacteria_type]) {
          formsByBacteria[form.bacteria_type] = [];
        }
        formsByBacteria[form.bacteria_type].push(form);
      });
    });
    
    return formsByBacteria;
  };

  // Compter le nombre total de formulaires en attente
  const getTotalPendingForms = () => {
    return Object.values(readingForms).reduce((total, forms) => total + forms.length, 0);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Calendrier des lectures" />

      <div className="bg-[#0d47a1] text-white py-4">
        <div className="container mx-auto px-4 flex items-center">
          <h1 className="text-2xl font-bold">Lectures Microbiologiques en Attente</h1>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="calendar" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full max-w-md mx-auto mb-6">
            <TabsTrigger value="calendar" className="flex items-center gap-2 w-1/2">
              <CalendarIcon className="h-4 w-4" />
              <span>Calendrier de lecture</span>
              <Badge className="ml-1 bg-[#0091CA]">{getTotalPendingForms()}</Badge>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2 w-1/2">
              <History className="h-4 w-4" />
              <span>Historique</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <Card className="bg-white rounded-lg shadow-md">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-bold">Calendrier des lectures</CardTitle>
                    <CardDescription>
                      Semaine du {format(weekDays[0] || new Date(), 'dd MMMM', { locale: fr })} au {format(weekDays[5] || new Date(), 'dd MMMM yyyy', { locale: fr })}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => changeWeek('prev')}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={resetToCurrentWeek}
                      className="h-8 text-xs"
                    >
                      Aujourd'hui
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => changeWeek('next')}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between mt-4">
                  <div className="flex gap-2">
                    <Button 
                      variant={calendarView === 'by-bacteria' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setCalendarView('by-bacteria')}
                      className="text-xs"
                    >
                      Par bactérie
                    </Button>
                    <Button 
                      variant={calendarView === 'by-day' ? 'default' : 'outline'} 
                      size="sm"
                      onClick={() => setCalendarView('by-day')}
                      className="text-xs"
                    >
                      Par jour
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={loadReadingForms}
                      className="text-xs flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Actualiser
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleViewFormsHistory}
                      className="text-xs flex items-center gap-1"
                    >
                      <History className="h-3 w-3" />
                      Historique
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-500">Chargement des lectures en attente...</p>
                  </div>
                ) : getTotalPendingForms() === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-lg bg-gray-50">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">Aucune lecture en attente</h3>
                    <p className="text-gray-500 mb-4">Il n'y a pas de formulaires en attente de lecture pour cette semaine.</p>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/quality-control')}
                      className="mx-auto"
                    >
                      Retour à l'accueil
                    </Button>
                  </div>
                ) : calendarView === 'by-bacteria' ? (
                  <div className="space-y-6">
                    {Object.entries(getFormsByBacteria()).map(([bacteria, forms]) => forms.length > 0 && (
                      <div key={bacteria} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-medium">{bacteria}</h3>
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                            {forms.length} formulaire(s)
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {forms.map(form => {
                            const bacteriaInfo = getBacteriaInfo(form.bacteria_type);
                            return (
                              <div 
                                key={form.form_id}
                                className={`border ${bacteriaInfo.color} rounded-lg p-4 cursor-pointer transition-all hover:shadow-md`}
                                onClick={() => handleOpenForm(form)}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <h4 className="font-medium">{form.report_title}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {form.reading_day}
                                  </Badge>
                                </div>
                                <div className="text-sm space-y-1">
                                  <div className="flex justify-between">
                                    <span>Site:</span>
                                    <span className="font-medium">{form.site}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Échantillons:</span>
                                    <span className="font-medium">{form.samples_count}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Délai:</span>
                                    <span className="font-medium">{bacteriaInfo.delay}</span>
                                  </div>
                                </div>
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="w-full mt-3 text-xs gap-1"
                                >
                                  <Microscope className="h-3 w-3" />
                                  Saisir les lectures
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {WEEKDAYS.map((day, index) => {
                      const formsForDay = readingForms[day] || [];
                      if (formsForDay.length === 0) return null;
                      
                      return (
                        <div key={day} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">
                              {day} ({format(weekDays[index] || new Date(), 'dd/MM', { locale: fr })})
                            </h3>
                            <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                              {formsForDay.length} formulaire(s)
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {formsForDay.map(form => {
                              const bacteriaInfo = getBacteriaInfo(form.bacteria_type);
                              return (
                                <div 
                                  key={form.form_id}
                                  className={`border ${bacteriaInfo.color} rounded-lg p-4 cursor-pointer transition-all hover:shadow-md`}
                                  onClick={() => handleOpenForm(form)}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium">{form.report_title}</h4>
                                    <Badge variant="outline" className="text-xs">
                                      {form.bacteria_type}
                                    </Badge>
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                      <span>Site:</span>
                                      <span className="font-medium">{form.site}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Échantillons:</span>
                                      <span className="font-medium">{form.samples_count}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Délai:</span>
                                      <span className="font-medium">{bacteriaInfo.delay}</span>
                                    </div>
                                  </div>
                                  <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="w-full mt-3 text-xs gap-1"
                                  >
                                    <Microscope className="h-3 w-3" />
                                    Saisir les lectures
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card className="bg-white rounded-lg shadow-md">
              <CardHeader>
                <CardTitle className="text-xl font-bold">Historique des lectures</CardTitle>
                <CardDescription>Accédez à toutes les lectures déjà effectuées</CardDescription>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleViewFormsHistory}
                  className="mt-2"
                >
                  <History className="h-4 w-4 mr-2" />
                  Voir l'historique complet
                </Button>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default ReadingCalendarPage; 