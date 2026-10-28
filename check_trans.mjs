import('./client/src/translations.js').then(m => {
  Object.keys(m.TRANSLATIONS).forEach(k => {
    const keys = Object.keys(m.TRANSLATIONS[k]);
    console.log(k, 'keys:', keys.length, 'has portal_title:', !!m.TRANSLATIONS[k].portal_title, 'has prompt_5:', !!m.TRANSLATIONS[k].prompt_5);
  });
  console.log('VALID - All languages loaded successfully');
}).catch(e => {
  console.error('ERROR:', e.message);
});
