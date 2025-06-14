import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableCell } from '@/components/ui/table';
import { Sample } from '@/types/samples';
import { CalendarIcon } from 'lucide-react';

interface CoordinatorFieldsProps {
  sample: Sample;
  isGrandFrais: boolean;
  GF_PRODUCTS: string[];
  updateSample: (id: string, field: keyof Sample, value: string) => void;
  isCoordinator: boolean;
  isLocked: boolean;
}

export const CoordinatorFields: React.FC<CoordinatorFieldsProps> = ({
  sample,
  isGrandFrais,
  GF_PRODUCTS,
  updateSample,
  isCoordinator,
  isLocked,
}) => {
  const [product, setProduct] = useState(sample.product || '');
  const [fabrication, setFabrication] = useState(sample.fabrication || '');
  const [dlc, setDlc] = useState(sample.dlc || '');
  
  useEffect(() => {
    setProduct(sample.product || '');
    setFabrication(sample.fabrication || '');
    setDlc(sample.dlc || '');
  }, [sample.product, sample.fabrication, sample.dlc]);

  const handleProductChange = (value: string) => {
    setProduct(value);
    updateSample(sample.id.toString(), 'product', value);
  };

  const handleFabricationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFabrication = e.target.value;
    setFabrication(newFabrication);
    updateSample(sample.id.toString(), 'fabrication', newFabrication);
  };
  
  const handleDlcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDlc = e.target.value;
    setDlc(newDlc);
    updateSample(sample.id.toString(), 'dlc', newDlc);
  };

  const handleInputChange = (field: keyof Sample, value: string) => {
    updateSample(sample.id.toString(), field, value);
  };

  return (
    <>
      <TableCell className="px-1 py-1 border-r border-gray-200 bg-blue-50 w-[180px]">
        {isGrandFrais ? (
          <Select 
            value={product} 
            onValueChange={handleProductChange}
            disabled={!isCoordinator || isLocked}
          >
            <SelectTrigger className="h-8 text-xs px-2 min-h-0 truncate" title={product}>
              <SelectValue placeholder="Produit" className="truncate" />
            </SelectTrigger>
            <SelectContent>
              {GF_PRODUCTS.map((prod) => (
                <SelectItem key={prod} value={prod} className="text-xs" title={prod}>
                  {prod}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input 
            value={product} 
            onChange={(e) => handleInputChange('product', e.target.value)} 
            className="w-full h-8 text-xs px-2 truncate"
            readOnly={!isCoordinator || isLocked}
            disabled={!isCoordinator || isLocked}
            title={product}
          />
        )}
      </TableCell>
      <TableCell className="px-1 py-1 border-r border-gray-200 bg-blue-50 w-[80px] align-middle">
        <div className="flex items-center justify-center h-full">
          <Input
            type="time"
            value={sample.readyTime || ''}
            onChange={(e) => handleInputChange('readyTime', e.target.value)}
            className="h-8 text-xs px-2 text-center w-full"
            readOnly={!isCoordinator || isLocked}
            disabled={!isCoordinator || isLocked}
          />
        </div>
      </TableCell>
      <TableCell className="px-1 py-1 border-r border-gray-200 bg-blue-50 w-[100px] align-middle">
        <div className="flex items-center justify-center h-full whitespace-nowrap">
          <Input
            type="date"
            value={fabrication}
            onChange={handleFabricationChange}
            className="h-8 text-xs text-center w-full"
            style={{ fontSize: '10px' }}
            readOnly={!isCoordinator || isLocked}
            disabled={!isCoordinator || isLocked}
          />
        </div>
      </TableCell>
      <TableCell className="px-1 py-1 border-r border-gray-200 bg-blue-50 w-[100px] align-middle">
        <div className="flex items-center justify-center h-full whitespace-nowrap">
          <Input
            type="date"
            value={dlc}
            onChange={handleDlcChange}
            className="h-8 text-xs text-center w-full"
            style={{ fontSize: '10px' }}
            readOnly={!isCoordinator || isLocked}
            disabled={!isCoordinator || isLocked}
          />
        </div>
      </TableCell>
    </>
  );
}; 