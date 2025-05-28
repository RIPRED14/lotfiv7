import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  CalendarIcon, ChevronLeft, ChevronRight,
  RefreshCw, Microscope, Clock, CheckCircle,
  AlertCircle, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from '@/hooks/use-toast';
import Header from '@/components/Header';
import { supabase } from '@/integrations/supabase/client';

// Interface pour les formulaires en attente de lecture
interface WaitingForm {
  form_id: string;
  report_title: string;
  brand: string;
  site: string;
  sample_count: number;
  bacteria_list: BacteriaSelection[];
  created_at: string;
  modified_at: string;
}

// Interface pour les bactéries sélectionnées
interface BacteriaSelection {
  id: string;
  form_id: string;
  bacteria_name: string;
  bacteria_delay: string;
  reading_day: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  modified_at: string;
  reading_date?: string;
}

// Interface pour les données du calendrier
interface CalendarData {
  [day: string]: {
    [bacteria: string]: BacteriaSelection[];
  };
}

// Constantes pour les bactéries et leurs couleurs
const BACTERIA_COLORS = {
  'Entérobactéries': 'bg-red-100 border-red-300 text-red-800 hover:bg-red-200',
  'Escherichia coli': 'bg-red-200 border-red-400 text-red-900 hover:bg-red-300',
  'Coliformes totaux': 'bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200',
  'Staphylocoques': 'bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200',
  'Listeria': 'bg-purple-100 border-purple-300 text-purple-800 hover:bg-purple-200',
  'Levures/Moisissures (3j)': 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200',
  'Flore totales': 'bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200',
  'Leuconostoc': 'bg-pink-100 border-pink-300 text-pink-800 hover:bg-pink-200',
  'Levures/Moisissures (5j)': 'bg-green-200 border-green-400 text-green-900 hover:bg-green-300',
  // Compatibilité avec l'ancien nom
  'Levures/Moisissures': 'bg-green-100 border-green-300 text-green-800 hover:bg-green-200',
};

const STATUS_COLORS = {
  'pending': 'bg-orange-100 text-orange-800 border-orange-300',
  'in_progress': 'bg-blue-100 text-blue-800 border-blue-300',
  'completed': 'bg-green-100 text-green-800 border-green-300'
};

const STATUS_ICONS = {
  'pending': <Clock className="w-3 h-3" />,
  'in_progress': <Microscope className="w-3 h-3" />,
  'completed': <CheckCircle className="w-3 h-3" />
};

// Jours de la semaine
const WEEKDAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const LecturesEnAttentePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [waitingForms, setWaitingForms] = useState<WaitingForm[]>([]);
  const [calendarData, setCalendarData] = useState<CalendarData>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'by-day' | 'by-bacteria'>('by-day');

  // Calculer les jours de la semaine
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

    loadWaitingForms();
  }, [currentWeek]);

  // Charger les formulaires en attente de lecture
  const loadWaitingForms = async () => {
    try {
      setLoading(true);

      // 1. Récupérer les échantillons avec statut 'waiting_reading'
      const { data: samplesData, error: samplesError } = await supabase
        .from('samples')
        .select('form_id, report_title, brand, site, created_at, modified_at')
        .eq('status', 'waiting_reading')
        .not('form_id', 'is', null);

      if (samplesError) throw samplesError;

      // 2. Récupérer les sélections de bactéries
      const { data: bacteriaData, error: bacteriaError } = await supabase
        .from('form_bacteria_selections')
        .select('*')
        .in('status', ['pending', 'in_progress']);

      if (bacteriaError) throw bacteriaError;

      // 3. Grouper les données
      const formsMap = new Map<string, WaitingForm>();
      const calendarMap: CalendarData = {};

      // Initialiser le calendrier
      WEEKDAYS.forEach(day => {
        calendarMap[day] = {};
      });

      // Traiter les échantillons
      samplesData?.forEach(sample => {
        if (!formsMap.has(sample.form_id)) {
          formsMap.set(sample.form_id, {
            form_id: sample.form_id,
            report_title: sample.report_title || `Formulaire ${sample.form_id}`,
            brand: sample.brand || 'Non spécifié',
            site: sample.site || 'Non spécifié',
            sample_count: 1,
            bacteria_list: [],
            created_at: sample.created_at,
            modified_at: sample.modified_at
          });
        } else {
          const form = formsMap.get(sample.form_id)!;
          form.sample_count += 1;
        }
      });

      // Traiter les bactéries et organiser par jour
      bacteriaData?.forEach(bacteria => {
        const form = formsMap.get(bacteria.form_id);
        if (form) {
          form.bacteria_list.push(bacteria);

          // Ajouter au calendrier
          const day = bacteria.reading_day;
          if (calendarMap[day]) {
            if (!calendarMap[day][bacteria.bacteria_name]) {
              calendarMap[day][bacteria.bacteria_name] = [];
            }
            calendarMap[day][bacteria.bacteria_name].push(bacteria);
          }
        }
      });

      setWaitingForms(Array.from(formsMap.values()));
      setCalendarData(calendarMap);

    } catch (error) {
      console.error('Erreur lors du chargement des formulaires en attente:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les formulaires en attente",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Changer de semaine
  const changeWeek = (direction: 'next' | 'prev') => {
    setCurrentWeek(prev => direction === 'next' ? prev + 1 : prev - 1);
  };

  // Revenir à la semaine actuelle
  const resetToCurrentWeek = () => {
    setCurrentWeek(0);
  };

  // Gérer la sélection d'une bactérie
  const handleSelectBacteria = async (bacteria: BacteriaSelection) => {
    try {
      // Marquer la bactérie comme "in_progress"
      const { error } = await supabase
        .from('form_bacteria_selections')
        .update({
          status: 'in_progress',
          modified_at: new Date().toISOString()
        })
        .eq('id', bacteria.id);

      if (error) throw error;

      toast({
        title: "Bactérie sélectionnée",
        description: `Redirection vers le formulaire pour ${bacteria.bacteria_name}...`,
        variant: "default"
      });

      // Rediriger vers le formulaire avec les informations de la bactérie
      navigate('/sample-entry', {
        state: {
          formId: bacteria.form_id,
          bacterie: bacteria.bacteria_name,
          comingFromReadingPage: true,
          reportTitle: `Lecture de ${bacteria.bacteria_name}`,
          delai: bacteria.bacteria_delay,
          jour: bacteria.reading_day
        }
      });

      // Actualiser les données
      await loadWaitingForms();

    } catch (error) {
      console.error('Erreur lors de la sélection de la bactérie:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sélectionner cette bactérie",
        variant: "destructive"
      });
    }
  };

  // Compter le nombre total de bactéries en attente
  const getTotalPendingBacteria = () => {
    return waitingForms.reduce((total, form) =>
      total + form.bacteria_list.filter(b => b.status === 'pending').length, 0
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <Header title="Lectures en Attente" />

      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white py-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-48 translate-x-48"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-32 -translate-x-32"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                <Microscope className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-2">Lectures Microbiologiques</h1>
                <p className="text-blue-100 text-lg">
                  Planification et suivi des analyses en attente
                </p>
                <div className="flex items-center space-x-6 text-blue-200 mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span>Système actif</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4" />
                    <span>{new Date().toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/30">
                <div className="text-3xl font-bold text-white">{getTotalPendingBacteria()}</div>
                <div className="text-blue-200 text-sm">Bactérie(s) en attente</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="calendar" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full max-w-lg mx-auto mb-8 bg-white shadow-lg border border-gray-200 p-1 rounded-xl">
            <TabsTrigger
              value="calendar"
              className="flex items-center gap-2 w-1/2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg py-3 px-4 transition-all duration-200"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="font-medium">Calendrier</span>
            </TabsTrigger>
            <TabsTrigger
              value="forms"
              className="flex items-center gap-2 w-1/2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-700 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg py-3 px-4 transition-all duration-200"
            >
              <FileText className="h-4 w-4" />
              <span className="font-medium">Formulaires</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="calendar" className="mt-4">
            <Card className="bg-white rounded-2xl shadow-xl border-0 overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-100">
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
                      className="h-10 w-10 p-0 rounded-xl border-2 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetToCurrentWeek}
                      className="h-10 px-4 text-xs font-medium rounded-xl border-2 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                    >
                      Aujourd'hui
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changeWeek('next')}
                      className="h-10 w-10 p-0 rounded-xl border-2 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between mt-4">
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'by-day' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('by-day')}
                      className="text-xs"
                    >
                      Par jour
                    </Button>
                    <Button
                      variant={viewMode === 'by-bacteria' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setViewMode('by-bacteria')}
                      className="text-xs"
                    >
                      Par bactérie
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadWaitingForms}
                    className="text-xs flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Actualiser
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-500">Chargement des lectures en attente...</p>
                  </div>
                ) : getTotalPendingBacteria() === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-lg bg-gray-50">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">Aucune lecture en attente</h3>
                    <p className="text-gray-500 mb-4">Il n'y a pas de bactéries en attente de lecture pour cette semaine.</p>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/quality-control')}
                      className="mx-auto"
                    >
                      Retour à l'accueil
                    </Button>
                  </div>
                ) : viewMode === 'by-day' ? (
                  // Vue par jour
                  <div className="space-y-6">
                    {WEEKDAYS.map((day, index) => {
                      const dayData = calendarData[day] || {};
                      const bacteriaCount = Object.values(dayData).reduce((total, bacteria) => total + bacteria.length, 0);

                      if (bacteriaCount === 0) return null;

                      return (
                        <div key={day} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium flex items-center gap-2">
                              {day}
                              <span className="text-sm text-gray-500">
                                ({format(weekDays[index] || new Date(), 'dd/MM', { locale: fr })})
                              </span>
                              {isSameDay(weekDays[index] || new Date(), new Date()) && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                                  Aujourd'hui
                                </Badge>
                              )}
                            </h3>
                            <Badge className="bg-blue-100 text-blue-800">
                              {bacteriaCount} lecture(s)
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(dayData).map(([bacteriaName, bacteriaList]) =>
                              bacteriaList.map(bacteria => {
                                const colorClass = BACTERIA_COLORS[bacteriaName as keyof typeof BACTERIA_COLORS] || 'bg-gray-100 border-gray-300 text-gray-800';
                                const statusClass = STATUS_COLORS[bacteria.status];
                                const statusIcon = STATUS_ICONS[bacteria.status];

                                return (
                                  <div
                                    key={bacteria.id}
                                    className={`border ${colorClass} rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${bacteria.status === 'completed' ? 'opacity-75' : ''}`}
                                    onClick={() => bacteria.status !== 'completed' && handleSelectBacteria(bacteria)}
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <h4 className="font-medium text-sm">{bacteriaName}</h4>
                                      <div className="flex items-center gap-1">
                                        <Badge variant="outline" className={`text-xs ${statusClass}`}>
                                          {statusIcon}
                                          <span className="ml-1">{bacteria.status}</span>
                                        </Badge>
                                      </div>
                                    </div>

                                    <div className="text-xs space-y-1">
                                      <div className="flex justify-between">
                                        <span>Délai:</span>
                                        <span className="font-medium">{bacteria.bacteria_delay}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Formulaire:</span>
                                        <span className="font-medium">{bacteria.form_id.slice(-6)}</span>
                                      </div>
                                    </div>

                                    {bacteria.status !== 'completed' && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        className="w-full mt-3 text-xs gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectBacteria(bacteria);
                                        }}
                                      >
                                        <Microscope className="h-3 w-3" />
                                        {bacteria.status === 'pending' ? 'Commencer la lecture' : 'Continuer la lecture'}
                                      </Button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Vue par bactérie
                  <div className="space-y-6">
                    {Object.entries(BACTERIA_COLORS).map(([bacteriaName, colorClass]) => {
                      const bacteriaList: BacteriaSelection[] = [];

                      // Collecter toutes les bactéries de ce type
                      Object.values(calendarData).forEach(dayData => {
                        if (dayData[bacteriaName]) {
                          bacteriaList.push(...dayData[bacteriaName]);
                        }
                      });

                      if (bacteriaList.length === 0) return null;

                      return (
                        <div key={bacteriaName} className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-medium">{bacteriaName}</h3>
                            <Badge className="bg-blue-100 text-blue-800">
                              {bacteriaList.length} lecture(s)
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {bacteriaList.map(bacteria => {
                              const statusClass = STATUS_COLORS[bacteria.status];
                              const statusIcon = STATUS_ICONS[bacteria.status];

                              return (
                                <div
                                  key={bacteria.id}
                                  className={`border ${colorClass} rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${bacteria.status === 'completed' ? 'opacity-75' : ''}`}
                                  onClick={() => bacteria.status !== 'completed' && handleSelectBacteria(bacteria)}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-medium text-sm">{bacteria.reading_day}</h4>
                                    <div className="flex items-center gap-1">
                                      <Badge variant="outline" className={`text-xs ${statusClass}`}>
                                        {statusIcon}
                                        <span className="ml-1">{bacteria.status}</span>
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="text-xs space-y-1">
                                    <div className="flex justify-between">
                                      <span>Délai:</span>
                                      <span className="font-medium">{bacteria.bacteria_delay}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Formulaire:</span>
                                      <span className="font-medium">{bacteria.form_id.slice(-6)}</span>
                                    </div>
                                  </div>

                                  {bacteria.status !== 'completed' && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="w-full mt-3 text-xs gap-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectBacteria(bacteria);
                                      }}
                                    >
                                      <Microscope className="h-3 w-3" />
                                      {bacteria.status === 'pending' ? 'Commencer la lecture' : 'Continuer la lecture'}
                                    </Button>
                                  )}
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

          <TabsContent value="forms" className="mt-4">
            <Card className="bg-white rounded-lg shadow-md">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl font-bold">Formulaires en attente de lecture</CardTitle>
                    <CardDescription>
                      Sélectionnez une bactérie dans un formulaire pour commencer la lecture microbiologique.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadWaitingForms}
                    className="text-xs flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Actualiser
                  </Button>
                </div>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-500">Chargement des formulaires...</p>
                  </div>
                ) : waitingForms.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-lg bg-gray-50">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-700 mb-1">Aucun formulaire en attente</h3>
                    <p className="text-gray-500 mb-4">Tous les formulaires ont été traités ou aucun n'a été envoyé aux lectures en attente.</p>
                    <Button
                      variant="outline"
                      onClick={() => navigate('/quality-control')}
                      className="mx-auto"
                    >
                      Retour à l'accueil
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {waitingForms.map((form) => (
                      <div key={form.form_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h3 className="font-semibold text-gray-800">{form.report_title}</h3>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <span>Site: <strong>{form.site}</strong></span>
                              <span>Marque: <strong>{form.brand}</strong></span>
                              <span>Échantillons: <strong>{form.sample_count}</strong></span>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                            En attente
                          </Badge>
                        </div>

                        <div className="mb-3">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Bactéries à analyser :</h4>
                          <div className="flex flex-wrap gap-2">
                            {form.bacteria_list.map((bacteria) => {
                              const isInProgress = bacteria.status === 'in_progress';
                              const isCompleted = bacteria.status === 'completed';
                              const colorClass = BACTERIA_COLORS[bacteria.bacteria_name as keyof typeof BACTERIA_COLORS] || 'bg-gray-100 border-gray-300 text-gray-800';

                              return (
                                <Button
                                  key={bacteria.id}
                                  variant={isCompleted ? "default" : isInProgress ? "secondary" : "outline"}
                                  size="sm"
                                  onClick={() => handleSelectBacteria(bacteria)}
                                  disabled={isCompleted}
                                  className={`
                                    ${isCompleted ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                                    ${isInProgress ? 'bg-blue-100 text-blue-800 border-blue-300' : ''}
                                    ${!isInProgress && !isCompleted ? `hover:bg-blue-50 hover:border-blue-300 ${colorClass}` : ''}
                                  `}
                                >
                                  {bacteria.bacteria_name}
                                  <span className="ml-1 text-xs">
                                    ({bacteria.reading_day})
                                  </span>
                                  {isCompleted && <span className="ml-1">✓</span>}
                                  {isInProgress && <span className="ml-1">⏳</span>}
                                </Button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="text-xs text-gray-500">
                          Créé le {format(new Date(form.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {waitingForms.length > 0 && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-blue-800 font-medium mb-2">Instructions</h3>
                    <div className="text-blue-700 text-sm space-y-1">
                      <p>• Cliquez sur une bactérie pour commencer la lecture microbiologique</p>
                      <p>• Les bactéries en cours d'analyse sont marquées avec ⏳</p>
                      <p>• Les bactéries terminées sont marquées avec ✓</p>
                      <p>• Chaque bactérie a son propre délai de lecture (24h, 48h, 5j)</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default LecturesEnAttentePage;
