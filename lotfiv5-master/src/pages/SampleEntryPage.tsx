import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, DownloadCloud, ArrowLeft, Trash2, AlertTriangle, FileText, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from '@/contexts/AuthContext';
import BatchNumbers from '@/components/BatchNumbers';
import SamplesTable from '@/components/SamplesTable';
import SamplePageHeader from '@/components/SamplePageHeader';
import SampleActionButtons from '@/components/SampleActionButtons';
import { useSamples } from '@/hooks/useSamples';
import useBacteriaSelection from '@/hooks/useBacteriaSelection';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import FormStatusCard, { FormStatus } from '@/components/FormStatusCard';

const SampleEntryPage = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Référence pour suivre le nombre de rendus
  const renderCountRef = useRef(0);

  // Récupérer les paramètres d'URL si présents
  const [searchParams] = useSearchParams();
  const bacterieParam = searchParams.get('bacterie');
  const jourParam = searchParams.get('jour');
  const delaiParam = searchParams.get('delai');
  const siteParam = searchParams.get('site');

  // Éviter les logs excessifs
  useEffect(() => {
    if (renderCountRef.current <= 1) {
  console.log("Paramètres d'URL détectés:", { bacterieParam, jourParam, delaiParam, siteParam });
    }
    renderCountRef.current += 1;
  }, [bacterieParam, jourParam, delaiParam, siteParam]);

  // Générer un titre de rapport basé sur les paramètres URL si disponibles
  const generatedReportTitle = bacterieParam && delaiParam
    ? `Analyse de ${bacterieParam} (${delaiParam}) - ${jourParam || 'Non spécifié'}`
    : '';

  // Combiner les paramètres de state et d'URL
  const {
    reportTitle = generatedReportTitle,
    samples: savedSamples = [],
    brand = '',
    site = siteParam || '',
    sampleDate = '',
    reference = '',
    bacterie = bacterieParam || '',
    jour = jourParam || '',
    delai = delaiParam || '',
    isNew = location.state?.isNew || false,  // Vérifier si c'est un nouveau formulaire
    fromPendingPage = bacterieParam ? true : false,
    GF_PRODUCTS = ['Crème dessert vanille', 'Crème dessert chocolat', 'Crème dessert caramel'], // Valeur par défaut
    formId = location.state?.formId || '', // Récupérer l'ID du formulaire si venant de l'historique
    isFromHistory = location.state?.isFromHistory || false, // Vérifier si on vient de la page d'historique
    comingFromReadingPage = location.state?.comingFromReadingPage || false // Vérifier si on vient des lectures en attente
  } = location.state || {};

  const [waterPeptone, setWaterPeptone] = useState<string>('');
  const [petriDishes, setPetriDishes] = useState<string>('');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [selectedSamples, setSelectedSamples] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // État pour suivre si on vient de la page de lecture (utilise la valeur de location.state)
  const [comingFromReadingPageState, setComingFromReadingPageState] = useState<boolean>(fromPendingPage || comingFromReadingPage);
  // État pour gérer les lots de géloses
  const [geloseLots, setGeloseLots] = useState<Record<string, string>>({});

  // Récupérer les bactéries sélectionnées via le hook useBacteriaSelection
  const { selectedBacteria, toggleBacteria, addBacteria, removeBacteria } = useBacteriaSelection();

  // Modifier l'initialisation du hook useSamples pour respecter isNew et récupérer les états de connexion
  const {
    samples,
    addSample,
    updateSample,
    toggleConformity,
    validateSamples,
    addChangeHistory,
    sendToTechnician,
    deleteSample,
    loadSamplesByFormId // Récupérer la fonction pour charger les échantillons par ID de formulaire
  } = useSamples({
    savedSamples: isNew ? [] : savedSamples,  // Si c'est un nouveau formulaire, pas d'échantillons existants
    brand,
    isNewForm: isNew // Passer isNew comme isNewForm pour éviter de charger les anciens échantillons
  });

  // Ajouter une référence pour suivre si les échantillons ont déjà été créés
  const samplesCreatedRef = useRef(false);

  // Référence pour suivre l'URL précédente
  const previousUrlRef = useRef("");

  // Ajouter un état pour stocker l'ID du formulaire courant
  const [currentFormId, setCurrentFormId] = useState<string>(formId || '');

  // Ajouter l'état pour le statut du formulaire
  const [formStatus, setFormStatus] = useState<FormStatus>('draft');
  // État pour le jour de lecture
  const [readingDay, setReadingDay] = useState<string>(jour || 'Lundi');
  // État pour le type de bactérie
  const [bacteria, setBacteria] = useState<string>(bacterie || 'Entérobactéries');

  // Ajouter l'état pour la sélection des bactéries par le technicien
  const [selectedBacteriaForAnalysis, setSelectedBacteriaForAnalysis] = useState<string[]>([]);
  const [showBacteriaSelection, setShowBacteriaSelection] = useState<boolean>(false);

  // États pour les résultats microbiologiques
  const [readingResults, setReadingResults] = useState<Record<string, any>>({});
  const [readingComments, setReadingComments] = useState<string>('');
  const [isReadingMode, setIsReadingMode] = useState<boolean>(comingFromReadingPage);

  // Mapping entre les noms de bactéries et les IDs du système useBacteriaSelection
  const bacteriaMapping = {
    'Entérobactéries': 'entero',
    'Escherichia coli': 'ecoli',
    'Coliformes totaux': 'coliformes',
    'Staphylocoques': 'staphylocoques',
    'Listeria': 'listeria',
    'Levures/Moisissures (3j)': 'levures3j',
    'Flore totales': 'flores',
    'Leuconostoc': 'leuconostoc',
    'Levures/Moisissures (5j)': 'levures5j'
  };

  // Fonction pour synchroniser selectedBacteriaForAnalysis avec useBacteriaSelection
  const syncBacteriaSelection = (newSelectedBacteria: string[]) => {
    // Effacer toutes les sélections actuelles
    selectedBacteria.forEach(bacteriaId => {
      removeBacteria(bacteriaId);
    });

    // Ajouter les nouvelles sélections
    newSelectedBacteria.forEach(bacteriaName => {
      const bacteriaId = bacteriaMapping[bacteriaName as keyof typeof bacteriaMapping];
      if (bacteriaId) {
        addBacteria(bacteriaId);
      }
    });
  };

  // Effet pour charger les échantillons si on vient de la page d'historique
  useEffect(() => {
    if (isFromHistory && formId) {
      console.log("🔄 Chargement des échantillons du formulaire:", formId);
      setCurrentFormId(formId);

      // Notification de chargement
      toast({
        title: "Chargement",
        description: "Chargement des échantillons du formulaire...",
        duration: 2000
      });

      // Charger les échantillons de ce formulaire
      loadSamplesByFormId(formId);
    }
  }, [isFromHistory, formId]);

  // Effet pour charger les échantillons quand on vient de la page "Lectures en attente"
  useEffect(() => {
    if (comingFromReadingPage && formId) {
      console.log("🔄 Chargement des échantillons pour lecture:", formId, bacterie);
      setCurrentFormId(formId);
      setIsReadingMode(true);

      // Notification de chargement
      toast({
        title: "Mode lecture activé",
        description: `Préparation de la lecture pour ${bacterie}...`,
        duration: 3000
      });

      // Charger les échantillons de ce formulaire
      loadSamplesByFormId(formId);

      // Initialiser les résultats de lecture
      setReadingResults({});
    }
  }, [comingFromReadingPage, formId, bacterie]);

  // Effet pour récupérer le statut du formulaire au chargement
  useEffect(() => {
    if (currentFormId) {
      fetchFormStatus(currentFormId);
    }
  }, [currentFormId]);

  // Fonction pour récupérer le statut d'un formulaire
  const fetchFormStatus = async (formId: string) => {
    try {
      const { data, error } = await supabase
        .from('samples')
        .select('status')
        .eq('form_id', formId)
        .limit(1);

      if (error) {
        console.error("Erreur lors de la récupération du statut:", error);
        return;
      }

      if (data && data.length > 0) {
        const status = data[0].status as FormStatus;
        setFormStatus(status || 'draft');

        // Si le formulaire est en lecture, utiliser les valeurs par défaut
        if (status === 'waiting_reading') {
          // On utilise simplement les valeurs par défaut ou de l'URL
          setBacteria(bacterie || 'Entérobactéries');
          setReadingDay(jour || 'Lundi');
        }
      }
    } catch (error) {
      console.error("Erreur lors de la récupération du statut:", error);
    }
  };

  // Gérer le changement de statut du formulaire
  const handleStatusChange = async (newStatus: FormStatus) => {
    setFormStatus(newStatus);

    // Si le statut change à "waiting_reading", on doit mettre à jour les informations
    // de jour de lecture et bactérie sur tous les échantillons
    if (newStatus === 'waiting_reading') {
      try {
        // Notification de succès
        toast({
          title: "Lecture planifiée",
          description: `La lecture de ${bacteria} est planifiée pour ${readingDay}`,
          duration: 3000
        });
      } catch (error) {
        console.error("Erreur lors de la mise à jour des informations de lecture:", error);
      }
    }
  };

  // Modification du useEffect principal qui cause la boucle
  useEffect(() => {
    // Si l'URL n'a pas changé, ne rien faire
    const currentUrl = window.location.href;
    if (previousUrlRef.current === currentUrl) {
      return;
    }
    previousUrlRef.current = currentUrl;

    // Fonction pour ajouter un échantillon avec des paramètres
    const createSampleWithParams = async (bacterie, jour, delai, site) => {
      // Si les échantillons ont déjà été créés, ne pas les recréer
      if (samplesCreatedRef.current) {
        console.log("Les échantillons ont déjà été créés, ignoré.");
        return;
      }

      console.log("DÉMARRAGE CRÉATION ÉCHANTILLONS pour:", bacterie);

      // Récupérer le nom de la marque depuis l'état de navigation
      const { brandName } = location.state || {};

      // Utiliser le nom de la marque comme produit par défaut
      const defaultProduct = brandName || '';
      console.log("Nom de la marque utilisé comme produit:", defaultProduct);

      const currentDate = new Date();
      const formattedDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

      // Ajouter 3 échantillons
      try {
        for (let i = 0; i < 3; i++) {
          console.log(`Création de l'échantillon ${i+1}/3 pour ${bacterie}...`);

          // Attendre que l'échantillon soit ajouté avant de passer au suivant
          const result = await addSample(defaultProduct, {
            enterobacteria: bacterie === 'Entérobactéries' ? '' : null,
            yeastMold: bacterie.includes('levure') || bacterie.includes('moisissure') ? '' : null,
            site: site || 'R1',
            analysisType: bacterie,
            analysisDelay: delai || '24h',
            readingDay: jour || 'Lundi',
            fabrication: formattedDate,
            brandName: brandName // Transmettre le nom de la marque
          });

          console.log(`Résultat création échantillon ${i+1}:`, result);

          // Pause courte entre les ajouts
          await new Promise(resolve => setTimeout(resolve, 700));
        }

        // Message de confirmation après tous les échantillons
        toast({
          title: "Échantillons créés",
          description: `3 échantillons pour ${bacterie} (${delai || 'délai non spécifié'}) ont été ajoutés automatiquement`,
          duration: 5000
        });

        console.log("Tous les échantillons ont été créés avec succès!");
      } catch (error) {
        console.error("Erreur lors de la création des échantillons:", error);
        toast({
          title: "Erreur",
          description: "Impossible de créer tous les échantillons automatiquement. Veuillez utiliser le bouton 'Ajouter un échantillon'.",
          variant: "destructive",
          duration: 5000
        });
      }

      // Marquer que les échantillons ont été créés
      samplesCreatedRef.current = true;

      // Supprimer les paramètres de l'URL après la création des échantillons
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    };

    // Obtenir les paramètres directement de l'URL une seule fois lors du montage initial
    const urlParams = new URLSearchParams(window.location.search);
    const urlBacterie = urlParams.get('bacterie');
    const urlJour = urlParams.get('jour');
    const urlDelai = urlParams.get('delai');
    const urlSite = urlParams.get('site');

    if (renderCountRef.current <= 1) {
    console.log("URL COMPLÈTE:", window.location.href);
    console.log("Paramètres URL détectés:", {
      bacterie: urlBacterie,
      jour: urlJour,
      delai: urlDelai,
      site: urlSite
    });
    }

    // Si des paramètres sont trouvés dans l'URL ET que ce n'est pas un nouveau formulaire, créer des échantillons
    if (urlBacterie && !isNew && !samplesCreatedRef.current) {
      console.log("Paramètres de bactérie détectés, création d'échantillons...");

      // Notification
      toast({
        title: "Création d'échantillons",
        description: `Préparation de l'analyse pour ${urlBacterie} (${urlDelai || 'délai non spécifié'})`,
        duration: 3000
      });

      // Créer les échantillons après un petit délai
      setTimeout(() => {
        createSampleWithParams(urlBacterie, urlJour, urlDelai, urlSite);
        setComingFromReadingPage(true);
      }, 1500);
    }

    // Nettoyer l'effet lors du démontage
    return () => {
      // Rien à nettoyer
    };
  }, []); // Dépendance vide pour n'exécuter qu'une seule fois au montage

  const handleSave = async () => {
    if (!validateSamples()) return;

    setIsLoading(true);

    try {
      // Si c'est un technicien en mode "analyses_en_cours", activer la sélection des bactéries après sauvegarde
      const shouldShowBacteriaSelection = user?.role === 'technician' && formStatus === 'analyses_en_cours';

      // Collecter les échantillons à sauvegarder
      const samplesToSave = samples.map(sample => {
        return {
          ...sample,
          form_id: currentFormId,
          status: formStatus
        };
      });

      // Créer un identifiant unique pour le formulaire s'il n'existe pas déjà
      const formId = reportTitle || `Formulaire-${new Date().toISOString().slice(0, 10)}`;

      // Préparer les données des lots de milieux pour l'enregistrement
      const batchData = {
        report_id: formId,
        water_peptone: waterPeptone,
        petri_dishes: petriDishes,
        // Ajouter les géloses dynamiques
        ...Object.entries(geloseLots).reduce((acc, [key, value]) => {
          const columnName = key
            .toLowerCase()
            .replace(/gélose\s+/i, '')
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '')
            .concat('_gel');
          acc[columnName] = value;
          return acc;
        }, {})
      };

      // Enregistrer dans Supabase
      const { error: batchError } = await supabase
        .from('batch_numbers')
        .insert([batchData]);

      if (batchError) throw batchError;

      let samplesUpdated = 0;

      // Logique spécifique selon le rôle et le statut
      if (user?.role === 'technician' && formStatus === 'analyses_en_cours') {
        // Technicien remplissant les analyses de base (odeur, texture, goût, aspect, pH)
        for (const sample of samplesToSave) {
              const sampleId = typeof sample.id === 'number' ? String(sample.id) : sample.id;

            const sampleData = {
              smell: sample.smell || 'N',
              texture: sample.texture || 'N',
              taste: sample.taste || 'N',
              aspect: sample.aspect || 'N',
              ph: typeof sample.ph === 'number' ? String(sample.ph) : (sample.ph || ''),
            status: 'analyses_en_cours', // Maintenir le statut
              modified_at: new Date().toISOString(),
            modified_by: user?.name || 'Technicien'
            };

              const { error } = await supabase
                .from('samples')
                .update(sampleData)
                .eq('id', sampleId);

          if (error) throw error;
          samplesUpdated++;
              }
            } else {
        // Logique existante pour les autres cas
        // ... existing save logic ...
      }

      // Sauvegarde locale
      localStorage.setItem('savedAnalysis', JSON.stringify({
        reportTitle,
        formId,
        samples: samplesToSave,
        date: new Date().toISOString(),
        brand,
        site: site,
        batchNumbers: {
          waterPeptone,
          petriDishes,
        }
      }));

      addChangeHistory({
        action: 'save',
        user: user?.name || 'Unknown',
        role: user?.role || 'guest'
      });

      toast({
        title: "Analyse sauvegardée",
        description: `${samplesUpdated} échantillon(s) enregistré(s) avec succès.`,
      });

      // Si technicien en analyses en cours, afficher la sélection des bactéries
      if (shouldShowBacteriaSelection) {
        setShowBacteriaSelection(true);
        toast({
          title: "Analyses de base terminées",
          description: "Vous pouvez maintenant sélectionner les bactéries à analyser.",
          duration: 5000
        });
      }

    } catch (error) {
      console.error('Error saving analysis:', error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder l'analyse",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const checkLockStatus = () => {
      const storedAnalysis = localStorage.getItem('savedAnalysis');
      if (storedAnalysis) {
        const { lockedByCoordinator } = JSON.parse(storedAnalysis);
        if (lockedByCoordinator) setIsLocked(true);
      }
    };

    checkLockStatus();
  }, []); // Only run once on mount

  const handleSendToTechnician = async () => {
    if (!validateSamples()) return;

    setIsLoading(true);

    // Convertir les IDs numériques en chaînes
    const selectedSampleIds = selectedSamples.length > 0
      ? selectedSamples.map(id => id.toString())
      : undefined;

    const success = await sendToTechnician(selectedSampleIds);
    setIsLoading(false);

    if (success) {
      // Rediriger vers la page de contrôle de qualité après envoi au technicien
      setTimeout(() => {
        navigate('/quality-control');
      }, 1500);
    }
  };

  const handleToggleSelectSample = (sampleId: number) => {
    if (selectedSamples.includes(sampleId)) {
      setSelectedSamples(selectedSamples.filter(id => id !== sampleId));
    } else {
      setSelectedSamples([...selectedSamples, sampleId]);
    }
  };

  // Fonction pour gérer l'annulation des modifications
  const handleCancel = () => {
    // Réinitialiser les sélections
    setSelectedSamples([]);

    toast({
      title: "Opération annulée",
      description: "Les modifications ont été annulées."
    });
  };

  const handleDownload = () => {
    try {
      // Créer un objet avec toutes les données
      const dataToExport = {
        reportTitle,
        brand,
        site,
        sampleDate,
        reference,
        samples,
        batchNumbers: {
          waterPeptone,
          petriDishes,
        }
      };

      // Convertir en JSON
      const jsonString = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Créer un lien de téléchargement
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportTitle.replace(/\s+/g, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();

      // Nettoyer
      URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export réussi",
        description: "Les données ont été exportées avec succès",
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Erreur d'export",
        description: "Impossible d'exporter les données",
        variant: "destructive"
      });
    }
  };

  const isGrandFrais = brand === '1';
  const isCoordinator = user?.role === 'coordinator';
  const isTechnician = user?.role === 'technician';

  // Fonction pour revenir à la page des lectures en attente
  const handleReturnToPendingReadings = () => {
    navigate('/lectures-en-attente');
  };

  // Fonction pour ajouter un échantillon
  const handleAddSample = async () => {
    if (isLocked) return;

    try {
    setIsLoading(true);

      // Générer une référence unique pour l'échantillon si elle n'existe pas déjà
      let sampleReference = reference;
      if (!sampleReference) {
        // Format: SITE-YYYYMMDD-XXXX où XXXX est un identifiant aléatoire
        const today = new Date();
        const dateStr = format(today, 'yyyyMMdd');
        const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        sampleReference = `${site || 'SITE'}-${dateStr}-${randomId}`;
        console.log("Référence générée:", sampleReference);
      }

      // Construire les informations de l'échantillon
      const sampleInfo = {
        site: site || '',
        readyTime: '12:00', // Heure par défaut
        fabrication: format(new Date(), 'yyyy-MM-dd'),
        // Utiliser le produit par défaut basé sur le site
        product: isGrandFrais ? GF_PRODUCTS[0] : 'Produit standard',
      };

      console.log("Informations de l'échantillon:", sampleInfo);

      // Utiliser l'ID du formulaire existant ou en générer un nouveau
      const formIdToUse = currentFormId || `form-${new Date().toISOString().split('T')[0]}-${Math.random().toString(36).substring(2, 9)}`;
      console.log("ID du formulaire utilisé:", formIdToUse);

      // Si nous n'avons pas encore d'ID de formulaire, le stocker
      if (!currentFormId) {
        setCurrentFormId(formIdToUse);
      }

      // Ajouter les informations pour le formulaire
      const formInfo = {
        formId: formIdToUse,
        reportTitle: reportTitle || `Analyse du ${format(new Date(), 'dd/MM/yyyy')}`,
        brand: brand,
        reference: sampleReference,
        site: site
      };

      console.log("Informations du formulaire:", formInfo);

      // Appeler addSample avec les informations complètes
      const result = await addSample(sampleInfo.product, {
        ...sampleInfo,
        ...formInfo
      });

      console.log("Résultat de l'ajout d'échantillon:", result);

      if (result) {
        toast({
          title: "Échantillon ajouté",
          description: "Un nouvel échantillon a été ajouté avec succès.",
          duration: 3000
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible d'ajouter l'échantillon. Veuillez réessayer.",
          variant: "destructive",
          duration: 3000
        });
      }
    } catch (error) {
      console.error("Erreur lors de l'ajout d'échantillon:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'ajout de l'échantillon.",
        variant: "destructive",
        duration: 3000
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour revenir à la page d'historique des formulaires
  const handleReturnToFormsHistory = () => {
    navigate('/forms-history');
  };

  // Ajouter la sélection du jour de lecture et de la bactérie lors de l'étape "Analyses en cours"
  const renderReadingPlanningForm = () => {
    if (formStatus !== 'in_progress') return null;

    return (
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-blue-800 font-medium mb-2">Planifier la lecture microbiologique</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type de bactérie</label>
            <select
              value={bacteria}
              onChange={(e) => setBacteria(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2"
            >
              <option value="Entérobactéries">Entérobactéries (24h)</option>
              <option value="Escherichia coli">Escherichia coli (24h)</option>
              <option value="Coliformes totaux">Coliformes totaux (48h)</option>
              <option value="Staphylocoques">Staphylocoques (48h)</option>
              <option value="Listeria">Listeria (48h)</option>
              <option value="Levures/Moisissures (3j)">Levures/Moisissures (3j)</option>
              <option value="Flore totales">Flore totales (72h)</option>
              <option value="Leuconostoc">Leuconostoc (4j)</option>
              <option value="Levures/Moisissures (5j)">Levures/Moisissures (5j)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jour de lecture</label>
            <select
              value={readingDay}
              onChange={(e) => setReadingDay(e.target.value)}
              className="w-full rounded-md border border-gray-300 p-2"
            >
              <option value="Lundi">Lundi</option>
              <option value="Mardi">Mardi</option>
              <option value="Mercredi">Mercredi</option>
              <option value="Jeudi">Jeudi</option>
              <option value="Vendredi">Vendredi</option>
              <option value="Samedi">Samedi</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  // Ajouter la fonction pour envoyer aux analyses en cours (coordinateur)
  const handleSendToAnalysisInProgress = async () => {
    if (!validateSamples()) return;

    // Vérifier que des bactéries ont été sélectionnées
    if (selectedBacteriaForAnalysis.length === 0) {
      toast({
        title: "Sélection requise",
        description: "Veuillez sélectionner au moins une bactérie à analyser avant d'envoyer aux analyses en cours.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const currentDate = new Date();

      // 1. Sauvegarder les bactéries sélectionnées par le demandeur
      for (const bacteriaName of selectedBacteriaForAnalysis) {
        const bacteriaInfo = {
          'Entérobactéries': { delay: '24h', readingDay: 'J+1' },
          'Escherichia coli': { delay: '24h', readingDay: 'J+1' },
          'Coliformes totaux': { delay: '48h', readingDay: 'J+2' },
          'Staphylocoques': { delay: '48h', readingDay: 'J+2' },
          'Listeria': { delay: '48h', readingDay: 'J+2' },
          'Levures/Moisissures (3j)': { delay: '3j', readingDay: 'J+3' },
          'Flore totales': { delay: '72h', readingDay: 'J+3' },
          'Leuconostoc': { delay: '4j', readingDay: 'J+4' },
          'Levures/Moisissures (5j)': { delay: '5j', readingDay: 'J+5' }
        }[bacteriaName] || { delay: '24h', readingDay: 'J+1' };

        const { error: bacteriaError } = await supabase
          .from('form_bacteria_selections')
          .upsert({
            form_id: currentFormId,
            bacteria_name: bacteriaName,
            bacteria_delay: bacteriaInfo.delay,
            reading_day: bacteriaInfo.readingDay,
            status: 'pending',
            modified_at: currentDate.toISOString()
          });

        if (bacteriaError) throw bacteriaError;
      }

      // 2. Mettre à jour le statut de tous les échantillons vers "analyses_en_cours"
      for (const sample of samples) {
        const sampleId = typeof sample.id === 'number' ? String(sample.id) : sample.id;

        const { error } = await supabase
          .from('samples')
          .update({
            status: 'analyses_en_cours',
            form_id: currentFormId,
            analysis_type: selectedBacteriaForAnalysis.join(', '),
            modified_at: currentDate.toISOString(),
            modified_by: user?.name || 'Coordinateur'
          })
          .eq('id', sampleId);

        if (error) throw error;
      }

      // Mettre à jour le statut local
      setFormStatus('analyses_en_cours');

    toast({
        title: "Formulaire envoyé aux analyses en cours",
        description: `Bactéries sélectionnées : ${selectedBacteriaForAnalysis.join(', ')}. Le technicien peut maintenant remplir les analyses de base.`,
        duration: 4000
      });

      // Rediriger vers la page de contrôle qualité
      setTimeout(() => {
        navigate('/quality-control');
      }, 2000);

    } catch (error) {
      console.error('Erreur lors de l\'envoi aux analyses en cours:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le formulaire aux analyses en cours",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour sauvegarder les résultats microbiologiques
  const handleSaveReadingResults = async () => {
    if (!user || !formId || !bacterie) {
      toast({
        title: "Erreur",
        description: "Informations manquantes pour sauvegarder les résultats",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);

      // Valider qu'au moins un résultat a été saisi
      const hasResults = Object.values(readingResults).some(result =>
        Object.values(result).some(value => value && value.toString().trim() !== '')
      );

      if (!hasResults) {
        toast({
          title: "Aucun résultat",
          description: "Veuillez saisir au moins un résultat de lecture",
          variant: "destructive"
        });
        return;
      }

      const currentDate = new Date().toISOString();
      let updatedCount = 0;

      // Mettre à jour chaque échantillon avec les résultats
      for (const sample of samples) {
        const sampleResults = readingResults[sample.id];
        if (!sampleResults) continue;

        const updateData = {
          enterobacteria_count: sampleResults.enterobacteria_count ? Number(sampleResults.enterobacteria_count) : null,
          yeast_mold_count: sampleResults.yeast_mold_count ? Number(sampleResults.yeast_mold_count) : null,
          listeria_count: sampleResults.listeria_count ? Number(sampleResults.listeria_count) : null,
          coliforms_count: sampleResults.coliforms_count ? Number(sampleResults.coliforms_count) : null,
          staphylococcus_count: sampleResults.staphylococcus_count ? Number(sampleResults.staphylococcus_count) : null,
          reading_comments: readingComments,
          reading_technician: user.name,
          reading_date: currentDate,
          modified_at: currentDate,
          modified_by: user.name
        };

        const { error } = await supabase
          .from('samples')
          .update(updateData)
          .eq('id', sample.id);

        if (error) throw error;
        updatedCount++;
      }

      // Marquer la bactérie comme terminée dans form_bacteria_selections
      const { error: bacteriaError } = await supabase
        .from('form_bacteria_selections')
        .update({
          status: 'completed',
          modified_at: currentDate
        })
        .eq('form_id', formId)
        .eq('bacteria_name', bacterie);

      if (bacteriaError) throw bacteriaError;

      // Vérifier si toutes les bactéries du formulaire sont terminées
      const { data: allBacteria } = await supabase
        .from('form_bacteria_selections')
        .select('status')
        .eq('form_id', formId);

      const allCompleted = allBacteria?.every(b => b.status === 'completed');

      if (allCompleted) {
        // Marquer le formulaire comme archivé
        await supabase
          .from('samples')
          .update({ status: 'completed' })
          .eq('form_id', formId);

        toast({
          title: "🎉 Formulaire archivé automatiquement",
          description: `Lecture de ${bacterie} terminée pour ${updatedCount} échantillon(s). Toutes les bactéries ont été analysées, le formulaire a été archivé.`,
          duration: 6000
        });
      } else {
        toast({
          title: "Résultats sauvegardés",
          description: `Lecture de ${bacterie} terminée pour ${updatedCount} échantillon(s)`,
          duration: 4000
        });
      }

      // Rediriger vers les lectures en attente
      setTimeout(() => {
        navigate('/lectures-en-attente');
      }, 2000);

    } catch (error) {
      console.error('Erreur lors de la sauvegarde des résultats:', error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder les résultats",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour mettre à jour un résultat de lecture
  const updateReadingResult = (sampleId: string, field: string, value: string) => {
    setReadingResults(prev => ({
      ...prev,
      [sampleId]: {
        ...prev[sampleId],
        [field]: value
      }
    }));
  };

  // Fonction pour que le technicien envoie aux lectures en attente (après avoir rempli les 5 cases vertes)
  const handleSendToWaitingReadings = async () => {
    if (formStatus !== 'analyses_en_cours' || !isTechnician) {
      toast({
        title: "Action non autorisée",
        description: "Seul un technicien peut envoyer aux lectures en attente.",
        variant: "destructive"
      });
      return;
    }

    // Vérifier que les 5 cases vertes sont remplies
    const hasEmptyGreenFields = samples.some(sample =>
      !sample.smell || sample.smell === 'N' ||
      !sample.texture || sample.texture === 'N' ||
      !sample.taste || sample.taste === 'N' ||
      !sample.aspect || sample.aspect === 'N' ||
      !sample.ph || sample.ph === ''
    );

    if (hasEmptyGreenFields) {
      toast({
        title: "Champs obligatoires manquants",
        description: "Veuillez remplir tous les champs verts (Odeur, Texture, Goût, Aspect, pH) avant de continuer.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const currentDate = new Date();

      // Mettre à jour chaque échantillon avec les informations de lecture
      for (const sample of samples) {
        const sampleId = typeof sample.id === 'number' ? String(sample.id) : sample.id;

        const { error } = await supabase
          .from('samples')
          .update({
            status: 'waiting_reading',
            modified_at: currentDate.toISOString(),
            modified_by: user?.name || 'Technicien',
            // Sauvegarder les valeurs des 5 cases vertes
            smell: sample.smell,
            texture: sample.texture,
            taste: sample.taste,
            aspect: sample.aspect,
            ph: sample.ph
          })
          .eq('id', sampleId);

        if (error) throw error;
      }

      // Créer les sélections de bactéries par défaut si elles n'existent pas déjà
      const formIdToUse = currentFormId || samples[0]?.form_id;
      if (formIdToUse) {
        // Vérifier si des sélections existent déjà
        const { data: existingSelections } = await supabase
          .from('form_bacteria_selections')
          .select('id')
          .eq('form_id', formIdToUse);

        // Si aucune sélection n'existe, créer des sélections par défaut
        if (!existingSelections || existingSelections.length === 0) {
          const defaultBacteria = [
            { name: 'Entérobactéries', delay: '24h', day: 'J+1' },
            { name: 'Coliformes totaux', delay: '48h', day: 'J+2' },
            { name: 'Levures/Moisissures (5j)', delay: '5j', day: 'J+5' }
          ];

          for (const bacteria of defaultBacteria) {
            const { error: bacteriaError } = await supabase
              .from('form_bacteria_selections')
              .insert({
                form_id: formIdToUse,
                bacteria_name: bacteria.name,
                bacteria_delay: bacteria.delay,
                reading_day: bacteria.day,
                status: 'pending',
                created_at: currentDate.toISOString(),
                modified_at: currentDate.toISOString()
              });

            if (bacteriaError) {
              console.error('Erreur lors de la création de la sélection de bactérie:', bacteriaError);
            }
          }

          console.log(`✅ Sélections de bactéries créées pour le formulaire ${formIdToUse}`);
        }
      }

      // Mettre à jour le statut local
      setFormStatus('waiting_reading');

      toast({
        title: "Analyse organoleptique terminée",
        description: `${samples.length} échantillon(s) enregistré(s). Date d'ensemencement : ${currentDate.toLocaleDateString('fr-FR')}. Lectures programmées selon les délais de chaque bactérie.`,
        duration: 5000
      });

      // Rediriger vers les lectures en attente
      setTimeout(() => {
        navigate('/lectures-en-attente');
      }, 2000);

    } catch (error) {
      console.error('Erreur lors de l\'envoi aux lectures en attente:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer aux lectures en attente",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour vérifier si une bactérie est prête pour la lecture
  const isBacteriaReadyForReading = (bacteriaName: string, ensemencementDate: Date) => {
    const now = new Date();
    const timeDiff = now.getTime() - ensemencementDate.getTime();
    const hoursDiff = timeDiff / (1000 * 3600);

    const bacteriaDelays = {
      'Entérobactéries': 24,
      'Escherichia coli': 24,
      'Coliformes totaux': 48,
      'Staphylocoques': 48,
      'Listeria': 48,
      'Levures/Moisissures (3j)': 72,
      'Flore totales': 72,
      'Leuconostoc': 96,
      'Levures/Moisissures (5j)': 120
    };

    const requiredHours = bacteriaDelays[bacteriaName as keyof typeof bacteriaDelays] || 24;
    return hoursDiff >= requiredHours;
  };

  // Fonction pour afficher les champs de saisie des résultats microbiologiques
  const renderReadingResultsForm = () => {
    if (!isReadingMode || !bacterie) return null;

    // Vérifier si la bactérie est prête pour la lecture
    const ensemencementDate = new Date(); // En réalité, récupérer la vraie date d'ensemencement
    const isReady = isBacteriaReadyForReading(bacterie, ensemencementDate);

    return (
      <div className={`mb-6 p-6 border rounded-2xl ${isReady ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`font-medium ${isReady ? 'text-green-800' : 'text-orange-800'}`}>
            Saisie des résultats - {bacterie}
          </h3>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${isReady ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
            {isReady ? '✓ Prêt pour lecture' : '⏳ En attente du délai'}
          </div>
        </div>
        <p className={`text-sm mb-4 ${isReady ? 'text-green-700' : 'text-orange-700'}`}>
          {isReady
            ? 'Le délai d\'incubation est écoulé. Vous pouvez saisir les résultats de lecture microbiologique.'
            : 'Le délai d\'incubation n\'est pas encore écoulé. Cette bactérie ne peut pas encore être lue.'
          }
        </p>

        <div className="space-y-4">
          {samples.map((sample, index) => (
            <div key={sample.id} className="bg-white p-4 rounded-lg border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-3">Échantillon #{index + 1} - {sample.product}</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bacterie.toLowerCase().includes('entérobactéries') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Entérobactéries (UFC/g)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={readingResults[sample.id]?.enterobacteria_count || ''}
                      onChange={(e) => updateReadingResult(sample.id, 'enterobacteria_count', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </div>
                )}

                {bacterie.toLowerCase().includes('levures') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Levures/Moisissures (UFC/g)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={readingResults[sample.id]?.yeast_mold_count || ''}
                      onChange={(e) => updateReadingResult(sample.id, 'yeast_mold_count', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </div>
                )}

                {bacterie.toLowerCase().includes('listeria') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Listeria (UFC/g)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={readingResults[sample.id]?.listeria_count || ''}
                      onChange={(e) => updateReadingResult(sample.id, 'listeria_count', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </div>
                )}

                {bacterie.toLowerCase().includes('coliformes') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Coliformes totaux (UFC/g)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={readingResults[sample.id]?.coliforms_count || ''}
                      onChange={(e) => updateReadingResult(sample.id, 'coliforms_count', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </div>
                )}

                {bacterie.toLowerCase().includes('staphylocoques') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Staphylocoques (UFC/g)
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={readingResults[sample.id]?.staphylococcus_count || ''}
                      onChange={(e) => updateReadingResult(sample.id, 'staphylococcus_count', e.target.value)}
                      className="w-full rounded-md border border-gray-300 p-2"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Commentaires et observations
            </label>
            <textarea
              placeholder="Ajoutez vos commentaires sur la lecture des échantillons..."
              value={readingComments}
              onChange={(e) => setReadingComments(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 p-2"
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSaveReadingResults}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? "Sauvegarde..." : "Terminer la lecture"}
            </Button>

            <Button
              variant="outline"
              onClick={() => navigate('/lectures-en-attente')}
            >
              Annuler
            </Button>
          </div>
        </div>
      </div>
    );
  };





  // Récupérer la fonction login du contexte d'authentification
  const { login } = useAuth();

  // Fonction pour se connecter rapidement en tant que technicien (pour les tests)
  const handleQuickLogin = async (role: 'coordinator' | 'technician') => {
    try {
      await login(`${role}@test.com`, 'password', role);
      toast({
        title: "Connexion réussie",
        description: `Connecté en tant que ${role}`,
        duration: 2000
      });
    } catch (error) {
      console.error('Erreur de connexion:', error);
    }
  };

  // Fonction pour supprimer un échantillon individuel
  const handleDeleteSample = async (sampleId: string | number) => {
    try {
      setIsLoading(true);

      // Convertir l'ID en string
      const sampleIdStr = String(sampleId);

      // Supprimer de Supabase
      const { error } = await supabase
        .from('samples')
        .delete()
        .eq('id', sampleIdStr);

      if (error) throw error;

      // Supprimer de l'état local
      await deleteSample(sampleIdStr);

      // Si l'échantillon était sélectionné, le retirer de la sélection
      if (selectedSamples.includes(Number(sampleId))) {
        setSelectedSamples(selectedSamples.filter(id => id !== Number(sampleId)));
      }

      toast({
        title: "Échantillon supprimé",
        description: "L'échantillon a été supprimé avec succès.",
        duration: 3000
      });

      return true;

    } catch (error) {
      console.error('Erreur lors de la suppression de l\'échantillon:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'échantillon",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour supprimer tout le formulaire
  const handleDeleteForm = async () => {
    try {
      setIsLoading(true);

      if (currentFormId) {
        // Supprimer les sélections de bactéries
        const { error: bacteriaError } = await supabase
          .from('form_bacteria_selections')
          .delete()
          .eq('form_id', currentFormId);

        if (bacteriaError) throw bacteriaError;

        // Supprimer tous les échantillons du formulaire
        const { error: samplesError } = await supabase
          .from('samples')
          .delete()
          .eq('form_id', currentFormId);

        if (samplesError) throw samplesError;
      } else {
        // Si pas de form_id, supprimer tous les échantillons actuels
        for (const sample of samples) {
          const sampleId = typeof sample.id === 'number' ? String(sample.id) : sample.id;
          const { error } = await supabase
            .from('samples')
            .delete()
            .eq('id', sampleId);

          if (error) throw error;
        }
      }

      toast({
        title: "Formulaire supprimé",
        description: "Le formulaire et tous ses échantillons ont été supprimés.",
        duration: 3000
      });

      // Rediriger vers la page d'accueil
      setTimeout(() => {
        navigate('/quality-control');
      }, 1500);

    } catch (error) {
      console.error('Erreur lors de la suppression du formulaire:', error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le formulaire",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fonction pour nettoyer complètement la base de données (admin seulement)
  const handleCleanDatabase = async () => {
    try {
      setIsLoading(true);

      // Supprimer toutes les sélections de bactéries
      const { error: bacteriaError } = await supabase
        .from('form_bacteria_selections')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Supprimer tout

      if (bacteriaError) throw bacteriaError;

      // Supprimer tous les échantillons
      const { error: samplesError } = await supabase
        .from('samples')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Supprimer tout

      if (samplesError) throw samplesError;

      toast({
        title: "Base de données nettoyée",
        description: "Toutes les données ont été supprimées de la base de données.",
        duration: 3000
      });

      // Actualiser la page
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Erreur lors du nettoyage de la base de données:', error);
      toast({
        title: "Erreur",
        description: "Impossible de nettoyer la base de données",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 animate-fadeIn">
      <SamplePageHeader title={reportTitle || `Analyse de ${bacterie} (${delai})`} />

      {/* Boutons de connexion rapide pour les tests */}
      {!user && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
          <h3 className="text-yellow-800 font-medium mb-2">Mode Test - Connexion Rapide</h3>
          <div className="flex gap-2">
            <Button onClick={() => handleQuickLogin('coordinator')} variant="outline" size="sm">
              Se connecter comme Coordinateur
            </Button>
            <Button onClick={() => handleQuickLogin('technician')} variant="outline" size="sm">
              Se connecter comme Technicien
            </Button>
          </div>
        </div>
      )}

      <main className="container mx-auto px-4 py-8">
        {comingFromReadingPage && (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReturnToPendingReadings}
              className="flex items-center gap-2 text-[#0091CA] border-[#0091CA] hover:bg-[#e6f7ff]"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour au planning
            </Button>
          </div>
        )}

        {isFromHistory && (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReturnToFormsHistory}
              className="flex items-center gap-2 text-[#0091CA] border-[#0091CA] hover:bg-[#e6f7ff]"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour à l'historique
            </Button>
          </div>
        )}

        {comingFromReadingPage && samples.length > 0 && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-green-800 font-medium mb-2">Échantillons créés automatiquement</h3>
            <p className="text-green-700">
              {samples.length} échantillon(s) ont été créés automatiquement pour cette analyse.
              Vous pouvez maintenant les compléter et les enregistrer.
            </p>
          </div>
        )}

        {isFromHistory && samples.length > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-blue-800 font-medium mb-2">Formulaire chargé depuis l'historique</h3>
            <p className="text-blue-700">
              Vous consultez un formulaire existant contenant {samples.length} échantillon(s).
              {user?.role === 'coordinator' && " Vous pouvez modifier ces échantillons si nécessaire."}
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8 border-0 transition-all duration-300 hover:shadow-2xl bg-gradient-to-br from-white to-gray-50">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-800">Saisie des Échantillons</h2>
              </div>
              {reportTitle ? (
                <p className="text-gray-500 mt-1">{reportTitle}</p>
              ) : bacterie && delai ? (
                <p className="text-gray-500 mt-1">Analyse de {bacterie} ({delai}) - {jour}</p>
              ) : null}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span>Site: {site}</span>
                {jour && <><span>•</span><span>Jour: {jour}</span></>}
                {reference && <><span>•</span><span>Référence: {reference}</span></>}
                {sampleDate && <><span>•</span><span>Date: {sampleDate}</span></>}
              </div>
              {bacterie && delai && (
                <div className="mt-2 text-sm">
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    {bacterie} - Délai: {delai}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SampleActionButtons
                onSave={handleSave}
                onAdd={handleAddSample}
                showAddButton={isCoordinator && !isLocked && formStatus !== 'waiting_reading' && formStatus !== 'completed'}
                selectedSamples={selectedSamples.length}
              />

              {/* Bouton pour envoyer aux analyses en cours (coordinateur) */}
              {isCoordinator && formStatus === 'draft' && samples.length > 0 && (
                <Button
                  onClick={handleSendToAnalysisInProgress}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Envoi...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <ArrowRight className="h-4 w-4" />
                      <span>Envoyer aux analyses en cours</span>
                    </div>
                  )}
                </Button>
              )}

              {/* Bouton pour envoyer aux lectures en attente (technicien) */}
              {isTechnician && formStatus === 'analyses_en_cours' && samples.length > 0 && (
                <Button
                  onClick={handleSendToWaitingReadings}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Enregistrement...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5" />
                      <span>ENREGISTRER ET PROGRAMMER LECTURES</span>
                    </div>
                  )}
                </Button>
              )}

              {/* Boutons de suppression */}
              {samples.length > 0 && (
                <div className="flex gap-2 ml-4 border-l pl-4">
                  {/* Bouton pour supprimer le formulaire complet */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isLoading}
                        className="flex items-center gap-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer le formulaire
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Supprimer le formulaire complet
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action supprimera définitivement le formulaire et tous ses échantillons ({samples.length} échantillon(s)).
                          Cette action ne peut pas être annulée.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteForm}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Supprimer définitivement
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  {/* Bouton pour nettoyer la base de données (admin) */}
                  {user?.role === 'coordinator' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={isLoading}
                          className="flex items-center gap-1 bg-red-700 hover:bg-red-800"
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Nettoyer la BDD
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Nettoyer complètement la base de données
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            ⚠️ <strong>ATTENTION :</strong> Cette action supprimera TOUS les formulaires et échantillons de la base de données.
                            Cette action est irréversible et ne peut être effectuée que par un coordinateur.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleCleanDatabase}
                            className="bg-red-700 hover:bg-red-800"
                          >
                            Nettoyer la base de données
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form status card */}
          <div className="mb-6">
            <FormStatusCard
              formId={currentFormId}
              status={formStatus}
              bacteriaType={bacteria}
              readingDay={readingDay}
              sampleCount={samples.length}
              onStatusChange={handleStatusChange}
            />
          </div>

          {/* Reading planning form */}
          {renderReadingPlanningForm()}

          {/* Reading results form for microbiological analysis */}
          {renderReadingResultsForm()}



          <div className="bg-white p-5 rounded-xl border border-gray-200 mb-8 shadow-sm transition-all duration-300 hover:shadow-md">
            {samples.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <Plus className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">Aucun échantillon</h3>
                <p className="text-gray-500 max-w-md mb-6">Ajoutez des échantillons pour commencer l'analyse.</p>
                {isCoordinator && !isLocked && (
                  <Button
                    onClick={handleAddSample}
                    className="bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter un échantillon
                  </Button>
                )}
              </div>
            ) : (
              <>
                <SamplesTable
                  samples={samples}
                  isGrandFrais={isGrandFrais}
                  GF_PRODUCTS={GF_PRODUCTS}
                  updateSample={(id, updates) => {
                    updateSample(id, updates);
                    return true;
                  }}
                  toggleConformity={(id, field, value) => {
                    toggleConformity(id, field, value);
                    return true;
                  }}
                  isLocked={isLocked}
                  userRole={user?.role || 'guest'}
                  selectedSamples={selectedSamples}
                  onToggleSelectSample={handleToggleSelectSample}
                  onDeleteSample={handleDeleteSample}
                  site={site}
                />
              </>
            )}
          </div>

          {samples.length > 0 && isCoordinator && !isLocked && (
            <div className="flex justify-center mb-8">
              <Button
                variant="outline"
                onClick={handleAddSample}
                className="w-full md:w-auto max-w-xs mx-auto border-green-500 text-green-600 hover:bg-green-50 hover:border-green-600 transition-all duration-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un échantillon
              </Button>
            </div>
          )}

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm transition-all duration-300 hover:shadow-md">
            <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full mr-2">Info</span>
              Informations sur les lots
            </h3>
            <BatchNumbers
              waterPeptone={waterPeptone}
              setWaterPeptone={setWaterPeptone}
              petriDishes={petriDishes}
              setPetriDishes={setPetriDishes}
              selectedBacteria={selectedBacteria}
              geloseLots={geloseLots}
              setGeloseLots={setGeloseLots}
            />
          </div>

          {samples.length > 0 && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center text-sm text-gray-600">
                <div>
                  <span className="font-medium">{samples.length}</span> échantillon{samples.length > 1 ? 's' : ''} au total
                </div>
                {selectedSamples.length > 0 && (
                  <div>
                    <span className="font-medium">{selectedSamples.length}</span> sélectionné{selectedSamples.length > 1 ? 's' : ''}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>


    </div>
  );
};

export default SampleEntryPage;
