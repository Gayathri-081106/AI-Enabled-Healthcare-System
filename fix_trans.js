const fs = require('fs');
let code = fs.readFileSync('client/src/translations.js', 'utf8');

const replacements = [
  {
    target: ', "Healthcare & Telemedicine Portal",',
    repl: "    prompt_5: 'What is the difference between a general physician and a cardiologist?',\n    portal_title: \"Healthcare & Telemedicine Portal\","
  },
  {
    target: ', "சுகாதார மற்றும் தொலைமருத்துவ தளம்",',
    repl: "    prompt_5: 'பொது மருத்துவருக்கும் இதய மருத்துவருக்கும் என்ன வித்தியாசம்?',\n    portal_title: \"சுகாதார மற்றும் தொலைமருத்துவ தளம்\","
  },
  {
    target: ', "स्वास्थ्य एवं टेलीमेडिसिन पोर्टल",',
    repl: "    prompt_5: 'एक सामान्य चिकित्सक और हृदय रोग विशेषज्ञ में क्या अंतर है?',\n    portal_title: \"स्वास्थ्य एवं टेलीमेडिसिन पोर्टल\","
  },
  {
    target: ', "ఆరోగ్య & టెలిమెడిసిన్ పోర్టల్",',
    repl: "    prompt_5: 'జనరల్ ఫిజీషియన్‌కు కార్డియాలజిస్ట్‌కు మధ్య తేడా ఏమిటి?',\n    portal_title: \"ఆరోగ్య & టెలిమెడిసిన్ పోర్టల్\","
  },
  {
    target: ', "ആരോഗ്യ & ടെലിമെഡിസിൻ പോർട്ടൽ",',
    repl: "    prompt_5: 'ജനറൽ ഫിസിഷ്യനും കാർഡിയോളജിസ്റ്റും തമ്മിലുള്ള വ്യത്യാസം എന്താണ്?',\n    portal_title: \"ആരോഗ്യ & ടെലിമെഡിസിൻ പോർട്ടൽ\","
  },
  {
    target: ', "ಆರೋಗ್ಯ ಮತ್ತು ಟೆಲಿಮೆಡಿಸಿನ್ ಪೋರ್ಟಲ್",',
    repl: "    prompt_5: 'ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ಮತ್ತು ಹೃದ್ರೋಗ ತಜ್ಞರ ನಡುವಿನ ವ್ಯತ್ಯಾಸವೇನು?',\n    portal_title: \"ಆರೋಗ್ಯ ಮತ್ತು ಟೆಲಿಮೆಡಿಸಿನ್ ಪೋರ್ಟಲ್\","
  }
];

replacements.forEach(r => {
  if (code.includes(r.target)) {
    code = code.replace(r.target, r.repl);
  } else {
    console.warn('Target not found:', r.target.slice(0, 30));
  }
});

fs.writeFileSync('client/src/translations.js', code, 'utf8');
console.log('Successfully restored prompt_5 and formatted portal_title');
