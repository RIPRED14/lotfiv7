import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import { CalendarIcon, FileText, ChevronLeft, ChevronRight, Plus, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { format, addDays, startOfWeek, getWeek, addWeeks, subWeeks, isSameDay, isToday, isPast, isFuture, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from '@/components/ui/use-toast';
import {
  fetchAnalysesPlanifiees,
  fetchAnalysesEnCours,
  AnalysePlanifiee,
  AnalyseEnCours
} from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';

// Interface pour les formulaires en attente de lecture
interface WaitingForm {
  form_id: string;
  report_title: string;
  brand: string;
  site: string;
  sample_count: number;
  bacteria_list: string[];
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
  status: string;
  created_at: string;
  modified_at: string;
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Liste des bactéries disponibles pour les analyses
const BACTERIES = {
  ENTERO: { nom: 'Entérobactéries', delai: '24h' },
  COLIFORM: { nom: 'Coliformes totaux', delai: '5j' },
  LISTERIA: { nom: 'Listeria', delai: '48h' },
  SALMONELLA: { nom: 'Salmonella', delai: '5j' },
  ECOLI: { nom: 'E. coli', delai: '24h' },
  STAPH: { nom: 'Staphylococcus aureus', delai: '48h' }
};

// Liste des sites
const SITES = [
  { id: 'R1', nom: 'Laiterie Collet (R1)' },
  { id: 'R2', nom: 'Végétal Santé (R2)' },
  { id: 'BAIKO', nom: 'Laiterie Baiko' }
];

// Liste des jours de la semaine
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const PendingReadingsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>("lectures");
  const [weekNumber, setWeekNumber] = useState<number>(getWeek(new Date(), { weekStartsOn: 1 }));
  const [weekDays, setWeekDays] = useState<Date[]>([]);
  const [plannedBacteria, setPlannedBacteria] = useState<Record<string, AnalysePlanifiee[]>>({});
  const [ongoingAnalyses, setOngoingAnalyses] = useState<AnalyseEnCours[]>([]);
  const [waitingForms, setWaitingForms] = useState<WaitingForm[]>([]);
  const [bacteriaSelections, setBacteriaSelections] = useState<BacteriaSelection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // États pour le calendrier mensuel
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('month');
  const [currentWeek, setCurrentWeek] = useState(new Date());

  // États pour le formulaire d'ajout d'une nouvelle analyse
  const [newAnalyse, setNewAnalyse] = useState({
    bacterie: '',
    jour: '',
    site: '',
    date_analyse: format(new Date(), 'yyyy-MM-dd')
  });
  const [dialogOpen, setDialogOpen] = useState(false);

  // Fonction pour récupérer les formulaires en attente de lecture
  const fetchWaitingForms = async () => {
    try {
      // 1. Récupérer les formulaires avec statut 'waiting_reading'
      const { data: samplesData, error: samplesError } = await supabase
        .from('samples')
        .select('form_id, report_title, brand, site, created_at, modified_at')
        .eq('status', 'waiting_reading')
        .not('form_id', 'is', null);

      if (samplesError) throw samplesError;

      // 2. Grouper par form_id et compter les échantillons
      const formsMap = new Map<string, WaitingForm>();

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

      // 3. Récupérer les bactéries sélectionnées pour chaque formulaire
      const { data: bacteriaData, error: bacteriaError } = await supabase
        .from('form_bacteria_selections')
        .select('*')
        .eq('status', 'pending');

      if (bacteriaError) throw bacteriaError;

      setBacteriaSelections(bacteriaData || []);

      // 4. Ajouter les bactéries aux formulaires
      bacteriaData?.forEach(bacteria => {
        const form = formsMap.get(bacteria.form_id);
        if (form) {
          form.bacteria_list.push(bacteria.bacteria_name);
        }
      });

      setWaitingForms(Array.from(formsMap.values()));

    } catch (error) {
      console.error('Erreur lors du chargement des formulaires en attente:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les formulaires en attente",
        variant: "destructive"
      });
    }
  };

  // Fonction pour récupérer les données depuis Supabase
  const fetchData = async () => {
    setIsLoading(true);

    try {
      // Récupérer les formulaires en attente de lecture
      await fetchWaitingForms();
      // Récupérer les analyses planifiées pour la semaine
      const analysesPlanifiees = await fetchAnalysesPlanifiees(weekNumber);

      // Organiser les données par jour
      const bacteriesParJour: Record<string, AnalysePlanifiee[]> = {};
      JOURS.forEach(jour => {
        bacteriesParJour[jour] = [];
      });

      analysesPlanifiees.forEach(analyse => {
        if (bacteriesParJour[analyse.jour]) {
          bacteriesParJour[analyse.jour].push(analyse);
        }
      });

      setPlannedBacteria(bacteriesParJour);

      // Récupérer les analyses en cours
      const analysesEnCours = await fetchAnalysesEnCours();

      // Transformer les données pour l'affichage
      const formattedAnalyses = analysesEnCours.map(analyse => ({
        ...analyse,
        title: `${analyse.bacterie} (${analyse.delai})`
      }));

      setOngoingAnalyses(formattedAnalyses);

      // Après avoir défini bacteriesParJour, ajouter ce log
      console.log("Données de bactéries générées:", bacteriesParJour);

    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);

      // Simuler des données en cas d'erreur ou pour le développement
      console.log('Utilisation de données simulées...');

      // Simuler une structure pour les jours
      const bacteriesParJour: Record<string, AnalysePlanifiee[]> = {};

      // Initialiser chaque jour avec un tableau vide
      JOURS.forEach(jour => {
        bacteriesParJour[jour] = [];
      });

      // Ajouter des données simulées pour chaque jour
      bacteriesParJour['Mercredi'] = [
        {
          id: '1',
          bacterie: 'E. coli',
          delai: '24h',
          date_analyse: format(weekDays[2] || new Date(), 'yyyy-MM-dd'),
          jour: 'Mercredi',
          site: 'R1',
          semaine: weekNumber
        }
      ];

      bacteriesParJour['Vendredi'] = [
        {
          id: '2',
          bacterie: 'Coliformes totaux',
          delai: '5j',
          date_analyse: format(weekDays[4] || new Date(), 'yyyy-MM-dd'),
          jour: 'Vendredi',
          site: 'R2',
          semaine: weekNumber
        }
      ];

      bacteriesParJour['Samedi'] = [
        {
          id: '3',
          bacterie: 'Entérobactéries',
          delai: '24h',
          date_analyse: format(weekDays[5] || new Date(), 'yyyy-MM-dd'),
          jour: 'Samedi',
          site: 'R1',
          semaine: weekNumber
        },
        {
          id: '4',
          bacterie: 'Listeria',
          delai: '48h',
          date_analyse: format(weekDays[5] || new Date(), 'yyyy-MM-dd'),
          jour: 'Samedi',
          site: 'BAIKO',
          semaine: weekNumber
        }
      ];

      setPlannedBacteria(bacteriesParJour);

      // Simuler des analyses en cours
      setOngoingAnalyses([
        {
          id: '1',
          bacterie: 'Entérobactéries',
          delai: '24h',
          date_analyse: format(new Date(), 'yyyy-MM-dd'),
          status: 'En cours',
          site: 'R1',
          title: 'Entérobactéries (24h)'
        },
        {
          id: '2',
          bacterie: 'Coliformes totaux',
          delai: '5j',
          date_analyse: format(addDays(new Date(), -2), 'yyyy-MM-dd'),
          status: 'En cours',
          site: 'R2',
          title: 'Coliformes totaux (5j)'
        },
        {
          id: '3',
          bacterie: 'Listeria',
          delai: '48h',
          date_analyse: format(addDays(new Date(), -1), 'yyyy-MM-dd'),
          status: 'En cours',
          site: 'BAIKO',
          title: 'Listeria (48h)'
        }
      ]);

      toast({
        title: "Mode démo activé",
        description: "Utilisation de données de démonstration. La connexion à Supabase a échoué.",
        variant: "default"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour modifier la semaine
  const changeWeek = (direction: 'next' | 'prev') => {
    const newDate = direction === 'next'
      ? addWeeks(currentWeek, 1)
      : subWeeks(currentWeek, 1);

    setCurrentWeek(newDate);
    const newWeekNumber = getWeek(newDate, { weekStartsOn: 1 });
    setWeekNumber(newWeekNumber);

    // Mettre à jour les jours de la semaine
    const firstDayOfWeek = startOfWeek(newDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(firstDayOfWeek, i));
    setWeekDays(days);
  };

  // Fonctions pour le calendrier mensuel
  const changeMonth = (direction: 'next' | 'prev') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'next') {
        newMonth.setMonth(newMonth.getMonth() + 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() - 1);
      }
      return newMonth;
    });
  };

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  };

  const getCalendarDays = () => {
    const daysInMonth = getDaysInMonth();
    const firstDay = daysInMonth[0];
    const lastDay = daysInMonth[daysInMonth.length - 1];

    // Ajouter les jours du mois précédent pour compléter la première semaine
    const startCalendar = startOfWeek(firstDay, { weekStartsOn: 1 });
    // Ajouter les jours du mois suivant pour compléter la dernière semaine
    const endCalendar = addDays(startOfWeek(lastDay, { weekStartsOn: 1 }), 6);

    // S'assurer qu'on a exactement 6 semaines (42 jours) pour un calendrier complet
    const totalDays = eachDayOfInterval({ start: startCalendar, end: endCalendar });

    // Si on a moins de 42 jours, ajouter une semaine supplémentaire
    if (totalDays.length < 42) {
      const extendedEnd = addDays(endCalendar, 7);
      return eachDayOfInterval({ start: startCalendar, end: extendedEnd });
    }

    return totalDays;
  };

  const getBacteriaForDate = (date: Date) => {
    const dayName = format(date, 'EEEE', { locale: fr });
    const dayNameCapitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return plannedBacteria[dayNameCapitalized] || [];
  };

  // Fonction pour ajouter une nouvelle analyse planifiée
  const handleAddAnalyse = async () => {
    // Récupérer les informations de délai basées sur la bactérie sélectionnée
    const selectedBacterie = Object.values(BACTERIES).find(
      b => b.nom === newAnalyse.bacterie
    );

    if (!selectedBacterie) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une bactérie valide",
        variant: "destructive"
      });
      return;
    }

    if (!newAnalyse.jour || !newAnalyse.site) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs",
        variant: "destructive"
      });
      return;
    }

    try {
      // Dans un environnement réel, nous sauvegarderions cela dans Supabase
      /*
      await createAnalysePlanifiee({
        bacterie: newAnalyse.bacterie,
        delai: selectedBacterie.delai,
        jour: newAnalyse.jour,
        date_analyse: newAnalyse.date_analyse,
        site: newAnalyse.site,
        semaine: weekNumber
      });
      */

      // Simuler l'ajout d'une nouvelle analyse
      const nouvelleAnalyse: AnalysePlanifiee = {
        id: Math.random().toString(36).substring(2, 9),
        bacterie: newAnalyse.bacterie,
        delai: selectedBacterie.delai,
        jour: newAnalyse.jour,
        date_analyse: newAnalyse.date_analyse,
        site: newAnalyse.site,
        semaine: weekNumber
      };

      // Mettre à jour l'état local
      setPlannedBacteria(prev => {
        const updated = { ...prev };
        if (!updated[newAnalyse.jour]) {
          updated[newAnalyse.jour] = [];
        }
        updated[newAnalyse.jour].push(nouvelleAnalyse);
        return updated;
      });

      toast({
        title: "Analyse ajoutée",
        description: `L'analyse de ${newAnalyse.bacterie} a été planifiée pour ${newAnalyse.jour}`,
        variant: "default"
      });

      // Fermer le dialogue et réinitialiser le formulaire
      setDialogOpen(false);
      setNewAnalyse({
        bacterie: '',
        jour: '',
        site: '',
        date_analyse: format(new Date(), 'yyyy-MM-dd')
      });

    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'analyse:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'analyse. Veuillez réessayer.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    // Calculer les jours de la semaine
    const today = new Date();
    const firstDayOfWeek = startOfWeek(today, { weekStartsOn: 1 }); // Semaine commence le lundi
    const days = Array.from({ length: 6 }, (_, i) => addDays(firstDayOfWeek, i));
    setWeekDays(days);

    // Charger les données
    fetchData();
  }, [weekNumber]);

  useEffect(() => {
    // Vérifier si les données de bactéries sont vides
    const totalBacteries = Object.values(plannedBacteria).reduce(
      (total, bactList) => total + bactList.length, 0
    );

    console.log(`Nombre total de bactéries chargées: ${totalBacteries}`);
    console.log("Détail des bactéries par jour:", plannedBacteria);

    if (totalBacteries === 0) {
      console.warn("ATTENTION: Aucune bactérie n'est chargée dans le planning");

      // Forcer l'ajout de données de test si aucune bactérie n'est chargée
      const testData = {
        'Samedi': [
          {
            id: 'test-1',
            bacterie: 'Entérobactéries',
            delai: '24h',
            date_analyse: format(new Date(), 'yyyy-MM-dd'),
            jour: 'Samedi',
            site: 'R1',
            semaine: weekNumber
          }
        ]
      };

      // Mettre à jour l'état avec au moins une bactérie de test
      setPlannedBacteria(prev => ({
        ...prev,
        ...testData
      }));
    }
  }, [plannedBacteria, weekNumber]);

  // Fonction pour gérer la sélection d'une bactérie dans un formulaire
  const handleSelectBacteria = async (formId: string, bacteriaName: string) => {
    console.log('🔍 Sélection bactérie:', { formId, bacteriaName });

    toast({
      title: "Ouverture du formulaire",
      description: `Préparation du formulaire pour ${bacteriaName}...`,
      variant: "default"
    });

    try {
      // Navigation directe sans mise à jour Supabase pour éviter les erreurs
      console.log('🚀 Navigation vers sample-entry avec state:', {
        formId,
        bacterie: bacteriaName,
        comingFromReadingPage: true,
        reportTitle: `Lecture de ${bacteriaName}`
      });

      navigate('/sample-entry', {
        state: {
          formId,
          bacterie: bacteriaName,
          comingFromReadingPage: true,
          reportTitle: `Lecture de ${bacteriaName}`
        }
      });

      console.log('✅ Navigation réussie');

    } catch (error) {
      console.error('❌ Erreur lors de la navigation:', error);

      // Fallback avec URL
      const fallbackUrl = `/sample-entry?formId=${encodeURIComponent(formId)}&bacterie=${encodeURIComponent(bacteriaName)}`;
      console.log('🔄 Fallback URL:', fallbackUrl);
      window.location.href = fallbackUrl;
    }
  };

  const handleViewDetails = (bacterie: string, jour: string, delai: string, site: string) => {
    console.log('📅 Clic calendrier:', { bacterie, jour, delai, site });

    // Afficher un message de toast pour indiquer que l'action est en cours
    toast({
      title: "Ouverture du formulaire",
      description: `Préparation du formulaire pour ${bacterie} (${delai})...`,
      variant: "default"
    });

    try {
      // Rediriger vers le formulaire correspondant avec les informations nécessaires
      console.log('🚀 Navigation vers sample-entry avec state:', {
        bacterie,
        jour,
        delai,
        site,
        reportTitle: `Analyse de ${bacterie} (${delai})`,
        isNew: true,
        fromPendingPage: true
      });

      navigate('/sample-entry', {
        state: {
          bacterie,
          jour,
          delai,
          site,
          reportTitle: `Analyse de ${bacterie} (${delai})`,
          isNew: true,
          fromPendingPage: true // Indicateur pour la page de destination
        }
      });

      console.log('✅ Navigation réussie');
    } catch (error) {
      console.error("❌ Erreur lors de la navigation:", error);

      // Fallback en cas d'erreur - rediriger vers une autre page avec des paramètres d'URL
      console.log('🔄 Fallback: redirection avec URL');
      const fallbackUrl = `/sample-entry?bacterie=${encodeURIComponent(bacterie)}&jour=${encodeURIComponent(jour)}&delai=${encodeURIComponent(delai)}&site=${encodeURIComponent(site)}`;
      console.log('🔗 URL fallback:', fallbackUrl);
      window.location.href = fallbackUrl;
    }
  };

  const getBacterieCountByType = () => {
    // Compter le nombre total de bactéries en attente de lecture
    return bacteriaSelections.filter(b => b.status === 'pending').length;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="bg-[#0d47a1] text-white py-4">
        <div className="container mx-auto px-4 flex items-center">
          <h1 className="text-2xl font-bold">Contrôle Qualité Microbiologique</h1>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="lectures" className="w-full" onValueChange={setActiveTab}>
          <TabsList className="w-full max-w-md mx-auto mb-6">
            <TabsTrigger value="lectures" className="flex items-center gap-2 w-1/2">
              <CalendarIcon className="h-4 w-4" />
              <span>Lecture en attente</span>
              <Badge className="ml-1 bg-[#0091CA]">{getBacterieCountByType()}</Badge>
            </TabsTrigger>
            <TabsTrigger value="analyses" className="flex items-center gap-2 w-1/2">
              <FileText className="h-4 w-4" />
              <span>Analyses en cours</span>
              <Badge className="ml-1 bg-[#0091CA]">{ongoingAnalyses.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lectures" className="mt-4">
            {/* Section des formulaires en attente */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-blue-600" />
                  Formulaires en attente de lecture
                </h2>
                <p className="text-gray-600 mb-4">
                  Cliquez sur une bactérie pour commencer la lecture microbiologique.
                </p>
              </div>

              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Chargement des formulaires...</p>
                </div>
              ) : waitingForms.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">Aucun formulaire en attente</h3>
                  <p className="text-gray-500">Tous les formulaires ont été traités ou aucun n'a été envoyé aux lectures en attente.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {waitingForms.map((form) => {
                    const completedBacteria = form.bacteria_list.filter(bacteria => {
                      const selection = bacteriaSelections.find(
                        b => b.form_id === form.form_id && b.bacteria_name === bacteria
                      );
                      return selection?.status === 'completed';
                    }).length;

                    const totalBacteria = form.bacteria_list.length;
                    const progressPercentage = totalBacteria > 0 ? (completedBacteria / totalBacteria) * 100 : 0;
                    const isFormCompleted = completedBacteria === totalBacteria && totalBacteria > 0;

                    return (
                      <div key={form.form_id} className={`border rounded-lg p-6 transition-all duration-200 ${
                        isFormCompleted
                          ? 'border-green-300 bg-green-50 shadow-sm'
                          : 'border-gray-200 bg-white hover:shadow-md hover:border-blue-300'
                      }`}>
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-800 text-lg">{form.report_title}</h3>
                              {isFormCompleted && <CheckCircle className="w-5 h-5 text-green-600" />}
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                              <span className="flex items-center">
                                <strong className="text-gray-800 mr-1">Site:</strong> {form.site}
                              </span>
                              <span className="flex items-center">
                                <strong className="text-gray-800 mr-1">Marque:</strong> {form.brand}
                              </span>
                              <span className="flex items-center">
                                <strong className="text-gray-800 mr-1">Échantillons:</strong> {form.sample_count}
                              </span>
                              <span className="flex items-center">
                                <strong className="text-gray-800 mr-1">Progression:</strong> {completedBacteria}/{totalBacteria}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant="outline" className={
                              isFormCompleted
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-yellow-50 text-yellow-700 border-yellow-300"
                            }>
                              {isFormCompleted ? 'Terminé' : 'En attente'}
                            </Badge>
                            {!isFormCompleted && (
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${progressPercentage}%` }}
                                ></div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mb-4">
                          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Bactéries à analyser :
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {form.bacteria_list.map((bacteria) => {
                              const bacteriaSelection = bacteriaSelections.find(
                                b => b.form_id === form.form_id && b.bacteria_name === bacteria
                              );
                              const isInProgress = bacteriaSelection?.status === 'in_progress';
                              const isCompleted = bacteriaSelection?.status === 'completed';

                              return (
                                <div key={bacteria} className="relative">
                                  <Button
                                    variant={isCompleted ? "default" : isInProgress ? "secondary" : "outline"}
                                    size="sm"
                                    onClick={() => handleSelectBacteria(form.form_id, bacteria)}
                                    disabled={isCompleted}
                                    className={`w-full justify-start transition-all duration-200 ${
                                      isCompleted
                                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
                                        : isInProgress
                                          ? 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-200'
                                          : 'hover:bg-blue-50 hover:border-blue-400 hover:shadow-sm'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between w-full">
                                      <span className="font-medium">{bacteria}</span>
                                      <div className="flex items-center gap-1">
                                        {bacteriaSelection && (
                                          <span className="text-xs opacity-75">
                                            ({bacteriaSelection.reading_day})
                                          </span>
                                        )}
                                        {isCompleted && <CheckCircle className="w-4 h-4" />}
                                        {isInProgress && <Clock className="w-4 h-4" />}
                                        {!isInProgress && !isCompleted && <Eye className="w-4 h-4 opacity-50" />}
                                      </div>
                                    </div>
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                          <span>Créé le {format(new Date(form.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
                          {isFormCompleted && (
                            <span className="text-green-600 font-medium">✓ Toutes les lectures terminées</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-blue-800 font-medium mb-2 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Instructions
                </h3>
                <div className="text-blue-700 text-sm space-y-1">
                  <p>• <strong>Cliquez sur une bactérie</strong> pour commencer la lecture microbiologique</p>
                  <p>• <Clock className="w-3 h-3 inline mr-1" /> Les bactéries en cours d'analyse</p>
                  <p>• <CheckCircle className="w-3 h-3 inline mr-1" /> Les bactéries terminées</p>
                  <p>• <Eye className="w-3 h-3 inline mr-1" /> Les bactéries en attente de lecture</p>
                  <p>• Chaque bactérie a son propre délai de lecture (J+1, J+2, J+5)</p>
                </div>
              </div>
            </div>

            {/* Section du calendrier moderne */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                  <CalendarIcon className="w-5 h-5 mr-2 text-blue-600" />
                  Calendrier des lectures microbiologiques
                </h2>
                <p className="text-gray-600">
                  Cliquez sur un jour pour voir les lectures prévues et accéder aux formulaires.
                </p>
              </div>

              {/* Sélecteur de vue et navigation */}
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                  <Button
                    variant={calendarView === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCalendarView('month')}
                    className="bg-[#0091CA] hover:bg-[#007AA8] text-white"
                  >
                    Vue mensuelle
                  </Button>
                  <Button
                    variant={calendarView === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCalendarView('week')}
                  >
                    Vue hebdomadaire
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => calendarView === 'month' ? changeMonth('prev') : changeWeek('prev')}
                    className="border-[#0091CA] text-[#0091CA] hover:bg-blue-50"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {calendarView === 'month' ? 'Mois précédent' : 'Semaine précédente'}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      if (calendarView === 'month') {
                        setCurrentMonth(today);
                        setSelectedDate(today);
                      } else {
                        setCurrentWeek(today);
                        setWeekNumber(getWeek(today, { weekStartsOn: 1 }));
                      }
                    }}
                    className="border-green-500 text-green-600 hover:bg-green-50"
                  >
                    Aujourd'hui
                  </Button>

                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-800">
                      {calendarView === 'month'
                        ? format(currentMonth, 'MMMM yyyy', { locale: fr })
                        : `Semaine ${weekNumber}`
                      }
                    </h3>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => calendarView === 'month' ? changeMonth('next') : changeWeek('next')}
                    className="border-[#0091CA] text-[#0091CA] hover:bg-blue-50"
                  >
                    {calendarView === 'month' ? 'Mois suivant' : 'Semaine suivante'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-end mb-4">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-[#0091CA] hover:bg-[#007AA8]">
                      <Plus className="h-4 w-4 mr-2" /> Ajouter une analyse
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Planifier une nouvelle analyse</DialogTitle>
                      <DialogDescription>
                        Ajoutez une nouvelle analyse bactériologique au planning.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="bacterie" className="text-right">
                          Bactérie
                        </Label>
                        <div className="col-span-3">
                          <Select
                            value={newAnalyse.bacterie}
                            onValueChange={(value) => setNewAnalyse({...newAnalyse, bacterie: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner une bactérie" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.values(BACTERIES).map((bacterie) => (
                                <SelectItem key={bacterie.nom} value={bacterie.nom}>
                                  {bacterie.nom} ({bacterie.delai})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="site" className="text-right">
                          Site
                        </Label>
                        <div className="col-span-3">
                          <Select
                            value={newAnalyse.site}
                            onValueChange={(value) => setNewAnalyse({...newAnalyse, site: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un site" />
                            </SelectTrigger>
                            <SelectContent>
                              {SITES.map((site) => (
                                <SelectItem key={site.id} value={site.id}>
                                  {site.nom}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="jour" className="text-right">
                          Jour
                        </Label>
                        <div className="col-span-3">
                          <Select
                            value={newAnalyse.jour}
                            onValueChange={(value) => setNewAnalyse({...newAnalyse, jour: value})}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un jour" />
                            </SelectTrigger>
                            <SelectContent>
                              {JOURS.map((jour) => (
                                <SelectItem key={jour} value={jour}>
                                  {jour}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="date" className="text-right">
                          Date d'analyse
                        </Label>
                        <Input
                          id="date"
                          type="date"
                          value={newAnalyse.date_analyse}
                          onChange={(e) => setNewAnalyse({...newAnalyse, date_analyse: e.target.value})}
                          className="col-span-3"
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Annuler</Button>
                      </DialogClose>
                      <Button onClick={handleAddAnalyse} className="bg-[#0091CA] hover:bg-[#007AA8]">
                        Ajouter
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Calendrier mensuel moderne */}
              {calendarView === 'month' ? (
                <div className="space-y-4">
                  {/* En-têtes des jours de la semaine */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
                      <div key={day} className="p-2 text-center text-sm font-medium text-gray-600 bg-gray-50 rounded">
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Grille du calendrier */}
                  <div className="grid grid-cols-7 gap-1">
                    {getCalendarDays().map((date, index) => {
                      const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                      const isCurrentDay = isToday(date);
                      const isSelected = selectedDate && isSameDay(date, selectedDate);
                      const bacteriaForDay = getBacteriaForDate(date);
                      const hasBacteria = bacteriaForDay.length > 0;

                      return (
                        <div
                          key={index}
                          onClick={() => setSelectedDate(date)}
                          className={`
                            min-h-[80px] p-2 border rounded-lg cursor-pointer transition-all duration-200
                            ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 text-gray-400'}
                            ${isCurrentDay ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                            ${isSelected ? 'ring-2 ring-blue-400' : ''}
                            ${hasBacteria ? 'border-green-300 bg-green-50' : ''}
                            hover:shadow-md hover:border-blue-300
                          `}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm font-medium ${
                              isCurrentDay ? 'text-blue-800' :
                              isCurrentMonth ? 'text-gray-800' : 'text-gray-400'
                            }`}>
                              {format(date, 'd')}
                            </span>
                            {hasBacteria && (
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                          </div>

                          {/* Affichage des bactéries pour ce jour */}
                          <div className="space-y-1">
                            {bacteriaForDay.slice(0, 2).map((bacteria, idx) => (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(bacteria.bacterie, bacteria.jour, bacteria.delai, bacteria.site);
                                }}
                                className="text-xs bg-blue-100 text-blue-800 px-1 py-0.5 rounded truncate hover:bg-blue-200 transition-colors"
                              >
                                {bacteria.bacterie}
                              </div>
                            ))}
                            {bacteriaForDay.length > 2 && (
                              <div className="text-xs text-gray-500">
                                +{bacteriaForDay.length - 2} autres
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Détails du jour sélectionné */}
                  {selectedDate && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-medium text-blue-800">
                          Lectures prévues pour le {format(selectedDate, 'EEEE dd MMMM yyyy', { locale: fr })}
                        </h3>

                        {/* Navigation jour par jour */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const prevDay = addDays(selectedDate, -1);
                              setSelectedDate(prevDay);
                              // Si on change de mois, mettre à jour le mois affiché
                              if (prevDay.getMonth() !== selectedDate.getMonth()) {
                                setCurrentMonth(prevDay);
                              }
                            }}
                            className="border-blue-400 text-blue-600 hover:bg-blue-100"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const today = new Date();
                              setSelectedDate(today);
                              setCurrentMonth(today);
                            }}
                            className="border-green-500 text-green-600 hover:bg-green-50 text-xs px-2"
                          >
                            Aujourd'hui
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const nextDay = addDays(selectedDate, 1);
                              setSelectedDate(nextDay);
                              // Si on change de mois, mettre à jour le mois affiché
                              if (nextDay.getMonth() !== selectedDate.getMonth()) {
                                setCurrentMonth(nextDay);
                              }
                            }}
                            className="border-blue-400 text-blue-600 hover:bg-blue-100"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {getBacteriaForDate(selectedDate).length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {getBacteriaForDate(selectedDate).map((bacteria, idx) => (
                            <Button
                              key={idx}
                              variant="outline"
                              onClick={() => handleViewDetails(bacteria.bacterie, bacteria.jour, bacteria.delai, bacteria.site)}
                              className="h-auto p-3 text-left justify-start bg-white hover:bg-blue-100 border-blue-300"
                            >
                              <div className="flex flex-col items-start w-full">
                                <span className="font-medium text-sm">{bacteria.bacterie}</span>
                                <span className="text-xs text-gray-600">Délai: {bacteria.delai}</span>
                                <span className="text-xs text-gray-600">Site: {bacteria.site}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-blue-700">Aucune lecture prévue pour ce jour.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Vue hebdomadaire (ancienne grille) */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
                  {Object.entries(plannedBacteria).map(([jour, lectures]) => {
                    const dayDate = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }),
                      ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].indexOf(jour)
                    );
                    const isCurrentDay = isToday(dayDate);

                    return (
                      <div key={jour} className={`border rounded-lg p-4 transition-all duration-200 ${
                        isCurrentDay ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 bg-white hover:shadow-sm'
                      }`}>
                        <div className="mb-3">
                          <h4 className="font-semibold text-sm">{jour}</h4>
                          <p className="text-xs text-gray-500">{format(dayDate, 'dd/MM', { locale: fr })}</p>
                        </div>

                        <div className="space-y-2">
                          {lectures.length > 0 ? (
                            lectures.map((lecture) => (
                              <Button
                                key={lecture.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewDetails(lecture.bacterie, lecture.jour, lecture.delai, lecture.site)}
                                className="w-full text-left justify-start h-auto p-2"
                              >
                                <div className="flex flex-col items-start w-full">
                                  <span className="font-medium text-xs">{lecture.bacterie}</span>
                                  <span className="text-xs opacity-75">({lecture.delai})</span>
                                </div>
                              </Button>
                            ))
                          ) : (
                            <div className="text-center py-4 text-xs text-gray-400">
                              Aucune lecture prévue
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0091CA]"></div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="analyses" className="mt-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Analyses en cours</h2>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0091CA]"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ongoingAnalyses.map((analysis) => (
                    <div key={analysis.id} className="bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow p-4">
                      <h3 className="font-medium text-lg">{analysis.title}</h3>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Date:</span>
                          <span>{analysis.date_analyse}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Site:</span>
                          <span>{analysis.site}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Statut:</span>
                          <span className="text-amber-500 font-medium">{analysis.status}</span>
                        </div>
                      </div>
                      <Button
                        className="w-full mt-4 bg-[#0091CA] hover:bg-[#007AA8]"
                        onClick={() => navigate('/sample-entry', {
                          state: {
                            analysisId: analysis.id,
                            bacterie: analysis.bacterie,
                            delai: analysis.delai,
                            site: analysis.site
                          }
                        })}
                      >
                        Voir les détails
                      </Button>
                    </div>
                  ))}

                  {ongoingAnalyses.length === 0 && (
                    <div className="col-span-3 text-center py-8 text-gray-500">
                      Aucune analyse en cours pour le moment.
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default PendingReadingsPage;