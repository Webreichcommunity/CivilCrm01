export const normalizePhoneForWhatsapp = (phone = '') => phone.replace(/\D/g, '');

export const openWhatsAppMessage = (phone, message) => {
  const normalized = normalizePhoneForWhatsapp(phone);
  if (!normalized) return false;

  const url = `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
};

