import React from 'react';
import { Badge } from '@/components/ui/badge';

export interface Bacteria {
  id: string;
  name: string;
  delai: string;
}

export const BACTERIES: Bacteria[] = [
  { id: "entero", name: "Entérobactéries", delai: "24h" },
  { id: "ecoli", name: "Escherichia coli", delai: "24h" },
  { id: "coliformes", name: "Coliformes totaux", delai: "48h" },
  { id: "staphylocoques", name: "Staphylocoques", delai: "48h" },
  { id: "listeria", name: "Listeria", delai: "48h" },
  { id: "levures3j", name: "Levures/Moisissures", delai: "3j" },
  { id: "flores", name: "Flore totales", delai: "72h" },
  { id: "leuconostoc", name: "Leuconostoc", delai: "4j" },
  { id: "levures5j", name: "Levures/Moisissures", delai: "5j" },
];

interface BacteriaSelectorProps {
  selectedBacteria: string[];
  onToggle: (id: string) => void;
  className?: string;
}

const BacteriaSelector: React.FC<BacteriaSelectorProps> = ({
  selectedBacteria,
  onToggle,
  className = '',
}) => {
  return (
    <div className={`flex flex-wrap gap-2 mb-4 ${className}`}>
      {BACTERIES.map((bact) => (
        <Badge
          key={bact.id}
          variant={selectedBacteria.includes(bact.id) ? "default" : "outline"}
          onClick={() => onToggle(bact.id)}
          className="cursor-pointer hover:bg-blue-100 transition-colors"
        >
          {bact.name} ({bact.delai})
        </Badge>
      ))}
    </div>
  );
};

export default BacteriaSelector;