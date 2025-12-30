import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';

interface HeadersEditorProps {
  headers: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
  disabled?: boolean;
}

export function HeadersEditor({ headers, onChange, disabled }: HeadersEditorProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = Object.entries(headers);

  const handleAdd = () => {
    if (newKey.trim() && newValue.trim()) {
      onChange({ ...headers, [newKey.trim()]: newValue.trim() });
      setNewKey('');
      setNewValue('');
    }
  };

  const handleRemove = (key: string) => {
    const newHeaders = { ...headers };
    delete newHeaders[key];
    onChange(newHeaders);
  };

  const handleUpdate = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...headers };
    if (oldKey !== newKey) {
      delete newHeaders[oldKey];
    }
    newHeaders[newKey] = value;
    onChange(newHeaders);
  };

  return (
    <div className="space-y-3">
      <Label>Headers</Label>
      
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map(([key, value], index) => (
            <div key={index} className="flex gap-2 items-center">
              <Input
                placeholder="Header"
                value={key}
                onChange={(e) => handleUpdate(key, e.target.value, value)}
                disabled={disabled}
                className="flex-1"
              />
              <Input
                placeholder="Valor"
                value={value}
                onChange={(e) => handleUpdate(key, key, e.target.value)}
                disabled={disabled}
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(key)}
                disabled={disabled}
                className="shrink-0 text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <Input
          placeholder="Novo header"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          disabled={disabled}
          className="flex-1"
        />
        <Input
          placeholder="Valor"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          disabled={disabled}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleAdd}
          disabled={disabled || !newKey.trim() || !newValue.trim()}
          className="shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Adicione headers personalizados para a requisição do webhook
      </p>
    </div>
  );
}
