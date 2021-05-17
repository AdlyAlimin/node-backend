const phoneNumberFormatter = function (number) {
  let formatted = number
  if (!number.endsWith('@g.us') && !number.endsWith('@s.whatsapp.net')) {
    formatted = number.replace(/\D/g, '');
    if (formatted.startsWith('0')) {
      formatted = '62' + formatted.substr(1);
    }
    if (!formatted.endsWith('@c.us') && !formatted.endsWith('@s.whatsapp.net')) {
      formatted += '@c.us';
    }
  }

  return formatted;
}

module.exports = {
  phoneNumberFormatter
}