import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarIcon, Check, BarChart, Plus, History, ClipboardList, CalendarDays, FileText, Zap, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import NotificationPanel from '@/components/NotificationPanel';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';

const sites = [
  { id: 'R1', name: 'Laiterie Collet (R1)' },
  { id: 'R2', name: 'Végétal Santé (R2)' },
  { id: 'BAIKO', name: 'Laiterie Baiko' },
];

const QualityControlPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(new Date());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (user?.role === 'coordinator') {
      // Les coordinateurs sont redirigés vers la page technique pour définir le titre du formulaire
      navigate('/technical-info', {
        state: {
          selectedSite,
          analysisDate: date
        }
      });
    } else {
      // Technicians can only see existing analyses
      const storedAnalysis = localStorage.getItem('savedAnalysis');
      if (storedAnalysis) {
        const analysis = JSON.parse(storedAnalysis);
        navigate('/sample-entry', {
          state: {
            reportTitle: analysis.reportTitle || 'Rapport d\'analyse',
            samples: analysis.samples || [],
            brand: analysis.brand || '',
            selectedSite,
            analysisDate: date
          }
        });
      } else {
        navigate('/sample-entry', {
          state: {
            reportTitle: 'Nouveau rapport',
            samples: [],
            brand: '',
            selectedSite,
            analysisDate: date
          }
        });
      }
    }
  };

  const handleViewDashboard = () => {
    navigate('/quality-control-dashboard', {
      state: {
        selectedSite,
        analysisDate: date
      }
    });
  };

  // Fonction pour créer un nouveau formulaire avec données réinitialisées
  const handleCreateNewForm = () => {
    // Réinitialiser toutes les données du localStorage
    localStorage.clear();

    // Informer l'utilisateur
    alert("Toutes les données locales ont été effacées. Vous allez créer un formulaire entièrement vide.");

    navigate('/technical-info', {
      state: {
        selectedSite: '',
        analysisDate: new Date()
      }
    });
  };

  const handleViewFormsHistory = () => {
    navigate('/forms-history');
  };

  const handleViewReadingCalendar = () => {
    navigate('/lecture-calendar');
  };

  const handleViewAnalysisInProgress = () => {
    navigate('/analyses-en-cours');
  };

  const handleViewSampleManagement = () => {
    navigate('/gestion-echantillons');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-medium">Sélection du Site et Date</h2>

                <div className="space-y-2">
                  <Label htmlFor="site">Site</Label>
                  <RadioGroup
                    id="site"
                    value={selectedSite}
                    onValueChange={setSelectedSite}
                    className="space-y-2"
                  >
                    {sites.map((site) => (
                      <div key={site.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={site.id} id={`site-${site.id}`} />
                        <Label htmlFor={`site-${site.id}`} className="cursor-pointer">{site.name}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date">Date d'analyse</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="date"
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left",
                          !date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? (
                          format(date, "d MMMM yyyy", { locale: fr })
                        ) : (
                          <span>Sélectionner une date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                <Button
                  type="submit"
                  disabled={!selectedSite || !date}
                  className="bg-[#0091CA] hover:bg-[#007AA8] w-full sm:w-auto"
                >
                  <Check className="w-4 h-4 mr-2" />
                  {user?.role === 'coordinator' ? 'Créer une nouvelle analyse' : 'Accéder aux analyses'}
                </Button>

                {/* Boutons spécifiques selon le rôle */}
                {user?.role === 'coordinator' ? (
                  // Interface simplifiée pour le coordinateur (demandeur)
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-amber-500 text-amber-600 hover:bg-amber-50"
                      onClick={handleViewFormsHistory}
                    >
                      <History className="w-4 h-4 mr-2" />
                      Mes formulaires
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-purple-500 text-purple-600 hover:bg-purple-50"
                      onClick={handleViewSampleManagement}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Suivi des analyses
                    </Button>
                  </>
                ) : (
                  // Interface complète pour le technicien
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-orange-500 text-orange-600 hover:bg-orange-50"
                      onClick={handleViewAnalysisInProgress}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Analyses en cours
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-green-500 text-green-600 hover:bg-green-50"
                      onClick={handleViewReadingCalendar}
                    >
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Lectures en attente
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-amber-500 text-amber-600 hover:bg-amber-50"
                      onClick={handleViewFormsHistory}
                    >
                      <History className="w-4 h-4 mr-2" />
                      Historique
                    </Button>
                  </>
                )}
              </div>

              {user?.role === 'technician' && (
                <div className="text-sm text-amber-600 mt-2">
                  En tant que technicien, vous pouvez uniquement accéder aux analyses existantes pour compléter les données.
                </div>
              )}
            </form>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-medium mb-4">Accès rapide</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {user?.role === 'coordinator' ? (
                  // Interface simplifiée pour le coordinateur (demandeur)
                  <>
                    <Button
                      variant="outline"
                      className="justify-start py-6 border-blue-200 hover:bg-blue-50"
                      onClick={handleCreateNewForm}
                    >
                      <Plus className="w-5 h-5 mr-2 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">Nouveau formulaire</div>
                        <div className="text-xs text-gray-500">Créer un formulaire vide</div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="justify-start py-6 border-amber-200 hover:bg-amber-50"
                      onClick={handleViewDashboard}
                    >
                      <BarChart className="w-5 h-5 mr-2 text-amber-600" />
                      <div className="text-left">
                        <div className="font-medium">Statistiques</div>
                        <div className="text-xs text-gray-500">Tableaux de bord</div>
                      </div>
                    </Button>
                  </>
                ) : (
                  // Interface complète pour le technicien
                  <>
                    <Button
                      variant="outline"
                      className="justify-start py-6 border-blue-200 hover:bg-blue-50"
                      onClick={handleViewFormsHistory}
                    >
                      <ClipboardList className="w-5 h-5 mr-2 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">Formulaires</div>
                        <div className="text-xs text-gray-500">Consulter les formulaires</div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="justify-start py-6 border-green-200 hover:bg-green-50"
                      onClick={handleViewReadingCalendar}
                    >
                      <CalendarDays className="w-5 h-5 mr-2 text-green-600" />
                      <div className="text-left">
                        <div className="font-medium">Lectures</div>
                        <div className="text-xs text-gray-500">Calendrier des lectures</div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="justify-start py-6 border-orange-200 hover:bg-orange-50"
                      onClick={handleViewAnalysisInProgress}
                    >
                      <FileText className="w-5 h-5 mr-2 text-orange-600" />
                      <div className="text-left">
                        <div className="font-medium">Analyses en cours</div>
                        <div className="text-xs text-gray-500">Formulaires à analyser</div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="justify-start py-6 border-amber-200 hover:bg-amber-50"
                      onClick={handleViewDashboard}
                    >
                      <BarChart className="w-5 h-5 mr-2 text-amber-600" />
                      <div className="text-left">
                        <div className="font-medium">Statistiques</div>
                        <div className="text-xs text-gray-500">Tableaux de bord</div>
                      </div>
                    </Button>
                  </>
                )}
              </div>
            </div>

            <NotificationPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default QualityControlPage;
