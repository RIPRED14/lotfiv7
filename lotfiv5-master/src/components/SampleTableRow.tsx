import React, { useState } from 'react';
import { TableRow, TableCell } from '@/components/ui/table';
import { UserRole } from '@/contexts/AuthContext';
import { Sample } from '@/types/samples';
import { useSampleAlertStatus } from '@/hooks/useSampleAlertStatus';
import { CoordinatorFields } from './sample-table/CoordinatorFields';
import { TechnicianFields } from './sample-table/TechnicianFields';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageSquare, Trash2 } from 'lucide-react';
import DynamicBacteriaColumns from './DynamicBacteriaColumns';

interface SampleTableRowProps {
  sample: Sample;
  isGrandFrais: boolean;
  GF_PRODUCTS: string[];
  updateSample: (id: string, updates: Partial<Sample>) => boolean;
  toggleConformity: (id: string, field: string, value: string) => boolean;
  isLocked: boolean;
  userRole: UserRole | 'guest';
  isSelected?: boolean;
  onToggleSelect?: (id: number) => void;
  onDeleteSample?: (id: number | string) => boolean;
  showSelectionColumn?: boolean;
  style?: React.CSSProperties;
  className?: string;
  selectedBacteria?: string[];
  isTechnician?: boolean;
  site?: string;
}

const SampleTableRow: React.FC<SampleTableRowProps> = ({
  sample,
  isGrandFrais,
  GF_PRODUCTS,
  updateSample,
  toggleConformity,
  isLocked,
  userRole,
  isSelected = false,
  onToggleSelect,
  onDeleteSample,
  showSelectionColumn = false,
  style,
  className = '',
  selectedBacteria = [],
  isTechnician = false,
  site = 'R1'
}) => {
  const isCoordinator = userRole === 'coordinator';
  const alertStatus = useSampleAlertStatus(sample);
  const rowClassName = alertStatus === 'urgent' ? 'bg-red-50' : 
                      alertStatus === 'warning' ? 'bg-yellow-50' : '';
  const [comment, setComment] = useState(sample.labComment || '');

  const handleToggleSelect = () => {
    if (onToggleSelect) {
      onToggleSelect(Number(sample.id));
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newComment = e.target.value;
    setComment(newComment);
    updateSample(sample.id.toString(), { labComment: newComment });
  };

  const handleDelete = () => {
    if (!isCoordinator || isLocked) {
      console.log('Suppression impossible:', { isCoordinator, isLocked });
      return;
    }
    
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet échantillon ?')) {
      try {
        console.log('Tentative de suppression de l\'échantillon:', {
          id: sample.id,
          type: typeof sample.id,
          number: sample.number
        });
        
        if (onDeleteSample) {
          const success = onDeleteSample(sample.id as number | string);
          console.log('Résultat de la suppression:', success);
        } else {
          console.error('Fonction onDeleteSample non définie');
        }
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
      }
    }
  };

  return (
    <TableRow 
      style={style}
      className={`border-t border-gray-200 hover:bg-gray-50 transition-all duration-150 ${
        isSelected ? 'bg-blue-50' : ''
      } ${rowClassName} ${className}`}
    >
      {showSelectionColumn && (
        <TableCell className="px-1 py-1 border-r border-gray-200 w-[35px]">
          <div className="flex items-center justify-center">
            <Checkbox 
              checked={isSelected}
              onCheckedChange={handleToggleSelect}
              aria-label={`Sélectionner l'échantillon ${sample.number}`}
              className="h-4 w-4 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 transition-all"
            />
          </div>
        </TableCell>
      )}
      
      {/* Numéro d'échantillon - Première colonne */}
      <TableCell className="px-1 py-1 font-medium text-gray-800 border-r border-gray-200 whitespace-nowrap bg-blue-50 w-[65px]">
        <Input 
          value={sample.number} 
          onChange={(e) => updateSample(sample.id.toString(), { number: e.target.value })} 
          className="w-full h-8 text-xs font-medium px-2"
          readOnly={!isCoordinator || isLocked}
          disabled={!isCoordinator || isLocked}
        />
      </TableCell>

      {/* Colonne Site */}
      <TableCell className="px-1 py-1 font-medium text-gray-800 border-r border-gray-200 whitespace-nowrap bg-blue-50 w-[65px]">
        <Input 
          value={sample.site || site} 
          onChange={(e) => updateSample(sample.id.toString(), { site: e.target.value })} 
          className="w-full h-8 text-xs font-medium px-2"
          readOnly={!isCoordinator || isLocked}
          disabled={!isCoordinator || isLocked}
        />
      </TableCell>
      
      {/* Autres colonnes de coordinateur */}
      <CoordinatorFields
        sample={sample}
        isGrandFrais={isGrandFrais}
        GF_PRODUCTS={GF_PRODUCTS}
        updateSample={updateSample}
        isCoordinator={isCoordinator}
        isLocked={isLocked}
      />
      
      {/* Colonnes de technicien - sensorielles et pH */}
      <TechnicianFields
        sample={sample}
        toggleConformity={toggleConformity}
        updateSample={updateSample}
        isTechnician={isTechnician}
        alertStatus={alertStatus}
      />
      
      {/* Colonnes dynamiques de bactéries */}
      {selectedBacteria && selectedBacteria.length > 0 && (
        <DynamicBacteriaColumns
          selectedBacteria={selectedBacteria}
          removeBacteria={() => {}}  // On ne peut pas supprimer de cette rangée
          sample={sample}
          updateSample={updateSample}
          isTechnician={isTechnician}
        />
      )}
      
      {/* Colonne de commentaire */}
      {(isCoordinator || isTechnician) && !isLocked && (
     <>
       <TableCell className="px-1 py-1 border-r border-gray-200 w-[120px]">
         <div className="relative">
           <MessageSquare className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-400" />
           <Input
             value={comment}
             onChange={handleCommentChange}
             placeholder="Commentaire..."
             className="pl-6 text-xs h-8 bg-gray-50 hover:bg-white focus:bg-white transition-colors px-2"
           />
         </div>
       </TableCell>
       <TableCell className="px-1 py-1 w-[45px]">
         <div className="flex justify-center">
           <Button
             variant="ghost"
             size="icon"
             onClick={handleDelete}
             className="w-7 h-7 rounded-full hover:bg-red-100 hover:text-red-600 transition-colors p-0"
             title="Supprimer l'échantillon"
           >
             <Trash2 className="h-4 w-4" />
           </Button>
         </div>
       </TableCell>
     </>
   )}
    </TableRow>
  );
};

export default SampleTableRow;
