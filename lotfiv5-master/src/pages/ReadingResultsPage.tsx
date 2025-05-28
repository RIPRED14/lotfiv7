import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, Save, Calculator, AlertTriangle, CheckCircle, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Sample {
  id: string;
  form_id: string;
  report_title: string;
  product: string;
  site: string;
  brand: string;
  status: string;
  analysis_type: string;
  reading_day: string;
  created_at: string;
  // Champs de lecture microbiologique
  enterobacteria_count?: number | null;
  yeast_mold_count?: number | null;
  listeria_count?: number | null;
  coliforms_count?: number | null;
  staphylococcus_count?: number | null;
  // Commentaires et observations
  reading_comments?: string | null;
  reading_technician?: string | null;
  reading_date?: string | null;
}

const ReadingResultsPage: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Récupérer les paramètres d'URL
  const formId = searchParams.get('formId');
  const bacteriaType = searchParams.get('bacteria');
  const day = searchParams.get('day');
  
  const [samples, setSamples] = useState<Sample[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // États pour les résultats de lecture
  const [readingResults, setReadingResults] = useState<Record<string, any>>({});
  const [comments, setComments] = useState<string>('');

  // Charger les échantillons en attente de lecture pour ce formulaire
  const loadSamples = async () => {
    if (!formId) {
      toast({
        title: "Erreur",
        description: "Aucun formulaire spécifié",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('samples')
        .select('*')
        .eq('form_id', formId)
        .eq('status', 'waiting_reading')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setSamples(data || []);
      
      // Initialiser les résultats avec les valeurs existantes
      const initialResults: Record<string, any> = {};
      data?.forEach(sample => {
        initialResults[sample.id] = {
          enterobacteria_count: sample.enterobacteria_count || '',
          yeast_mold_count: sample.yeast_mold_count || '',
          listeria_count: sample.listeria_count || '',
          coliforms_count: sample.coliforms_count || '',
          staphylococcus_count: sample.staphylococcus_count || ''
        };
      });
      setReadingResults(initialResults);
      
      // Charger les commentaires existants
      if (data && data.length > 0) {
        setComments(data[0].reading_comments || '');
      }
      
    } catch (error) {
      console.error('Erreur lors du chargement des échantillons:', error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger les échantillons",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSamples();
  }, [formId]);

  // Mettre à jour un résultat de lecture
  const updateReadingResult = (sampleId: string, field: string, value: string) => {
    setReadingResults(prev => ({
      ...prev,
      [sampleId]: {
        ...prev[sampleId],
        [field]: value
      }
    }));
  };

  // Sauvegarder les résultats de lecture
  const handleSaveResults = async () => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Utilisateur non connecté",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSaving(true);
      
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

      // Mettre à jour chaque échantillon
      for (const sample of samples) {
        const sampleResults = readingResults[sample.id];
        if (!sampleResults) continue;

        const updateData = {
          enterobacteria_count: sampleResults.enterobacteria_count ? Number(sampleResults.enterobacteria_count) : null,
          yeast_mold_count: sampleResults.yeast_mold_count ? Number(sampleResults.yeast_mold_count) : null,
          listeria_count: sampleResults.listeria_count ? Number(sampleResults.listeria_count) : null,
          coliforms_count: sampleResults.coliforms_count ? Number(sampleResults.coliforms_count) : null,
          staphylococcus_count: sampleResults.staphylococcus_count ? Number(sampleResults.staphylococcus_count) : null,
          reading_comments: comments,
          reading_technician: user.name,
          reading_date: currentDate,
          status: 'completed', // Marquer comme terminé
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

      toast({
        title: "Résultats sauvegardés",
        description: `${updatedCount} échantillon(s) mis à jour avec succès`,
        duration: 4000
      });

      // Rediriger vers le calendrier des lectures après un délai
      setTimeout(() => {
        navigate('/lecture-calendar');
      }, 2000);

    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      toast({
        title: "Erreur de sauvegarde",
        description: "Impossible de sauvegarder les résultats",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Obtenir le champ approprié selon le type de bactérie
  const getBacteriaField = (bacteriaType: string) => {
    switch (bacteriaType?.toLowerCase()) {
      case 'entérobactéries':
        return 'enterobacteria_count';
      case 'levures/moisissures':
        return 'yeast_mold_count';
      case 'listeria':
        return 'listeria_count';
      case 'coliformes totaux':
        return 'coliforms_count';
      case 'staphylocoques':
        return 'staphylococcus_count';
      default:
        return 'enterobacteria_count';
    }
  };

  const primaryField = getBacteriaField(bacteriaType || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des échantillons...</p>
        </div>
      </div>
    );
  }

  if (samples.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun échantillon en attente
            </h3>
            <p className="text-gray-600 mb-4">
              Aucun échantillon en attente de lecture pour ce formulaire.
            </p>
            <Button onClick={() => navigate('/lecture-calendar')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour au calendrier
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Eye className="h-8 w-8 text-blue-600" />
                Saisie des Résultats
              </h1>
              <p className="text-gray-600 mt-2">
                {bacteriaType && `Lecture de ${bacteriaType} • `}
                {day && `${day} • `}
                {samples.length} échantillon(s) à analyser
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/lecture-calendar')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au calendrier
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Informations du formulaire */}
          {samples[0] && (
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">
                  {samples[0].report_title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700 font-medium">Site:</span>
                    <div className="text-blue-900">{samples[0].site}</div>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Marque:</span>
                    <div className="text-blue-900">{samples[0].brand}</div>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Type d'analyse:</span>
                    <div className="text-blue-900">{samples[0].analysis_type}</div>
                  </div>
                  <div>
                    <span className="text-blue-700 font-medium">Jour de lecture:</span>
                    <div className="text-blue-900">{samples[0].reading_day}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Échantillons et résultats */}
          <div className="grid gap-4">
            {samples.map((sample, index) => (
              <Card key={sample.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">
                      Échantillon #{index + 1}
                    </CardTitle>
                    <Badge className="bg-amber-100 text-amber-800">
                      En attente de lecture
                    </Badge>
                  </div>
                  <p className="text-gray-600">{sample.product}</p>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bacteriaType?.toLowerCase().includes('entérobactéries') && (
                      <div>
                        <Label htmlFor={`enterobacteria-${sample.id}`}>
                          Entérobactéries (UFC/g)
                        </Label>
                        <Input
                          id={`enterobacteria-${sample.id}`}
                          type="number"
                          placeholder="0"
                          value={readingResults[sample.id]?.enterobacteria_count || ''}
                          onChange={(e) => updateReadingResult(sample.id, 'enterobacteria_count', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    {bacteriaType?.toLowerCase().includes('levures') && (
                      <div>
                        <Label htmlFor={`yeast-${sample.id}`}>
                          Levures/Moisissures (UFC/g)
                        </Label>
                        <Input
                          id={`yeast-${sample.id}`}
                          type="number"
                          placeholder="0"
                          value={readingResults[sample.id]?.yeast_mold_count || ''}
                          onChange={(e) => updateReadingResult(sample.id, 'yeast_mold_count', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    {bacteriaType?.toLowerCase().includes('listeria') && (
                      <div>
                        <Label htmlFor={`listeria-${sample.id}`}>
                          Listeria (UFC/g)
                        </Label>
                        <Input
                          id={`listeria-${sample.id}`}
                          type="number"
                          placeholder="0"
                          value={readingResults[sample.id]?.listeria_count || ''}
                          onChange={(e) => updateReadingResult(sample.id, 'listeria_count', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    {bacteriaType?.toLowerCase().includes('coliformes') && (
                      <div>
                        <Label htmlFor={`coliforms-${sample.id}`}>
                          Coliformes totaux (UFC/g)
                        </Label>
                        <Input
                          id={`coliforms-${sample.id}`}
                          type="number"
                          placeholder="0"
                          value={readingResults[sample.id]?.coliforms_count || ''}
                          onChange={(e) => updateReadingResult(sample.id, 'coliforms_count', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}

                    {bacteriaType?.toLowerCase().includes('staphylocoques') && (
                      <div>
                        <Label htmlFor={`staphylococcus-${sample.id}`}>
                          Staphylocoques (UFC/g)
                        </Label>
                        <Input
                          id={`staphylococcus-${sample.id}`}
                          type="number"
                          placeholder="0"
                          value={readingResults[sample.id]?.staphylococcus_count || ''}
                          onChange={(e) => updateReadingResult(sample.id, 'staphylococcus_count', e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Commentaires généraux */}
          <Card>
            <CardHeader>
              <CardTitle>Commentaires et observations</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Ajoutez vos commentaires sur la lecture des échantillons..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/lecture-calendar')}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSaveResults}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder les résultats
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReadingResultsPage; 