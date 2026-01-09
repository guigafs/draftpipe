import { useState, useMemo, useRef, useEffect } from 'react';
import { usePipefy } from '@/contexts/PipefyContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, User, X, Check, Mail, AtSign, UserX } from 'lucide-react';
import { PipefyMember } from '@/lib/pipefy-api';

interface UserSearchProps {
  label: string;
  placeholder?: string;
  selectedUser: PipefyMember | null;
  onUserSelect: (member: PipefyMember | null) => void;
  excludeUserId?: string;
  error?: string;
  allowNoAssignee?: boolean;
}

// Fake member to represent "No Assignee"
export const NO_ASSIGNEE_MEMBER: PipefyMember = {
  role_name: 'none',
  user: {
    id: '__NO_ASSIGNEE__',
    name: 'Sem Responsável',
    email: '__no_assignee__',
  }
};

export function UserSearch({
  label,
  placeholder = "Digite nome ou email...",
  selectedUser,
  onUserSelect,
  excludeUserId,
  error,
  allowNoAssignee = false
}: UserSearchProps) {
  const { members } = usePipefy();
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter members based on search term
  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return [];
    
    const term = searchTerm.toLowerCase();
    return members.filter(member => {
      if (excludeUserId && member.user.id === excludeUserId) return false;
      
      return (
        member.user.name?.toLowerCase().includes(term) ||
        member.user.email?.toLowerCase().includes(term) ||
        member.user.username?.toLowerCase().includes(term)
      );
    }).slice(0, 8); // Limit to 8 results
  }, [searchTerm, members, excludeUserId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (member: PipefyMember) => {
    onUserSelect(member);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onUserSelect(null);
    setSearchTerm('');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div ref={wrapperRef} className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      
      {/* Selected User Card */}
      {selectedUser ? (
        selectedUser.user.id === '__NO_ASSIGNEE__' ? (
          /* No Assignee Selected Card */
          <Card className="p-3 border-2 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center">
                  <UserX className="h-5 w-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">
                    Sem Responsável
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Buscar cards que não possuem responsável atribuído
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : (
          /* Normal User Selected Card */
          <Card className="p-3 border-2 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">
                  {getInitials(selectedUser.user.name || selectedUser.user.email)}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {selectedUser.user.name}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {selectedUser.role_name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {selectedUser.user.email}
                    </span>
                    {selectedUser.user.username && (
                      <span className="flex items-center gap-1">
                        <AtSign className="h-3 w-3" />
                        {selectedUser.user.username}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-success" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        )
      ) : (
        /* Search Input */
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder}
              className={`pl-10 ${error ? 'border-destructive' : ''}`}
            />
          </div>

          {/* Dropdown Results */}
          {isOpen && (filteredMembers.length > 0 || (allowNoAssignee && searchTerm === '')) && (
            <Card className="absolute z-50 w-full mt-1 p-1 shadow-lg max-h-80 overflow-y-auto bg-popover">
              {/* No Assignee Option */}
              {allowNoAssignee && searchTerm === '' && (
                <button
                  onClick={() => handleSelect(NO_ASSIGNEE_MEMBER)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left border-b border-border mb-1"
                >
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center">
                    <UserX className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">Sem Responsável</span>
                    <span className="text-xs text-muted-foreground block">
                      Cards sem responsável atribuído
                    </span>
                  </div>
                </button>
              )}
              {filteredMembers.map((member) => (
                <button
                  key={member.user.id}
                  onClick={() => handleSelect(member)}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-medium text-sm">
                    {getInitials(member.user.name || member.user.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {member.user.name}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {member.role_name}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground truncate block">
                      {member.user.email}
                    </span>
                  </div>
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </Card>
          )}

          {/* No results message */}
          {isOpen && searchTerm.length >= 2 && filteredMembers.length === 0 && (
            <Card className="absolute z-50 w-full mt-1 p-4 shadow-lg">
              <p className="text-sm text-muted-foreground text-center">
                Nenhum usuário encontrado para "{searchTerm}"
              </p>
            </Card>
          )}
        </div>
      )}

      {error && !selectedUser && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
