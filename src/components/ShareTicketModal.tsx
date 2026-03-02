import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { buildTicketWhatsappLink } from '@/utils/whatsapp';
import { Loader2 } from 'lucide-react';

interface ShareOption {
  id: string;
  label: string;
  phoneNumber?: string;
}

interface ShareTicketModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  ticket: {
    id: string;
    ticket_number: string;
    title: string;
    description?: string | null;
    customer_whatsapp?: string | null;
    status: string;
    priority: string;
    no_plat_kendaraan?: string | null;
    no_simcard_gps?: string | null;
  };
  shareOptions?: ShareOption[];
}

export const ShareTicketModal = ({
  isOpen,
  onOpenChange,
  ticket,
  shareOptions = [],
}: ShareTicketModalProps) => {
  const [selectedOption, setSelectedOption] = useState<string>(
    shareOptions.length > 0 ? shareOptions[0].id : 'customer'
  );
  const [customPhoneNumber, setCustomPhoneNumber] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleShare = () => {
    setIsLoading(true);
    
    let phoneNumber: string | undefined;
    
    if (selectedOption === 'customer') {
      phoneNumber = ticket.customer_whatsapp || undefined;
    } else if (selectedOption === 'custom') {
      phoneNumber = customPhoneNumber;
    } else {
      const option = shareOptions.find(opt => opt.id === selectedOption);
      phoneNumber = option?.phoneNumber;
    }

    if (!phoneNumber) {
      alert('Nomor WhatsApp tidak tersedia');
      setIsLoading(false);
      return;
    }

    try {
      const whatsappLink = buildTicketWhatsappLink({
        phoneNumber: phoneNumber,
        audience: selectedOption === 'customer' ? 'customer' : 'internal',
        ticket,
      });

      // Open WhatsApp in new window
      window.open(whatsappLink, '_blank', 'noopener,noreferrer');
      
      // Close modal after opening WhatsApp
      setTimeout(() => {
        onOpenChange(false);
        setIsLoading(false);
        setCustomPhoneNumber('');
        setSelectedOption(shareOptions.length > 0 ? shareOptions[0].id : 'customer');
      }, 500);
    } catch (error) {
      console.error('Error sharing ticket:', error);
      alert('Terjadi kesalahan saat membuka WhatsApp');
      setIsLoading(false);
    }
  };

  const isCustomSelected = selectedOption === 'custom';
  const isShareDisabled = !ticket.customer_whatsapp && selectedOption === 'customer' ||
    isCustomSelected && !customPhoneNumber ||
    selectedOption !== 'customer' && selectedOption !== 'custom' && 
    !shareOptions.find(opt => opt.id === selectedOption)?.phoneNumber;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Tiket ke WhatsApp</DialogTitle>
          <DialogDescription>
            Pilih penerima untuk berbagi tiket -{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {ticket.ticket_number}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
            {/* Customer Option */}
            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer">
              <RadioGroupItem value="customer" id="customer-option" />
              <Label 
                htmlFor="customer-option" 
                className="flex-1 cursor-pointer"
              >
                <div>
                  <p className="font-medium">Kirim ke Konsumen</p>
                  <p className="text-sm text-gray-500">
                    {ticket.customer_whatsapp ? ticket.customer_whatsapp : 'Nomor konsumen tidak tersedia'}
                  </p>
                </div>
              </Label>
            </div>

            {/* Predefined Share Options */}
            {shareOptions.map((option) => (
              <div 
                key={option.id}
                className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer"
              >
                <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                <Label 
                  htmlFor={`option-${option.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div>
                    <p className="font-medium">{option.label}</p>
                    {option.phoneNumber && (
                      <p className="text-sm text-gray-500">{option.phoneNumber}</p>
                    )}
                  </div>
                </Label>
              </div>
            ))}

            {/* Custom Number Option */}
            <div className="flex items-start space-x-2 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900">
              <RadioGroupItem value="custom" id="custom-option" className="mt-3" />
              <div className="flex-1">
                <Label 
                  htmlFor="custom-option"
                  className="font-medium cursor-pointer"
                >
                  Kirim ke Nomor Lain
                </Label>
                <Input
                  id="custom-phone"
                  placeholder="Masukkan nomor WhatsApp (misal: 081234567890)"
                  value={customPhoneNumber}
                  onChange={(e) => {
                    setCustomPhoneNumber(e.target.value);
                    setSelectedOption('custom');
                  }}
                  className="mt-2"
                  disabled={selectedOption !== 'custom'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gunakan format: 62xxxxx atau 0xxxx
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Batal
          </Button>
          <Button 
            onClick={handleShare}
            disabled={isShareDisabled || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Membuka WhatsApp...' : 'Bagikan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
