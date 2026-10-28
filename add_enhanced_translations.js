const fs = require('fs');

const extraTranslations = {
  English: {
    video_call: 'Video Call',
    voice_call: 'Voice Call',
    in_person: 'In-Person',
    consultation_type: 'Consultation Type',
    available_slots: 'Available Slots',
    book_for_patient: 'Book for Patient',
    reschedule: 'Reschedule',
    patient_profile: 'Patient Profile',
    medical_history: 'Medical History',
    allergies: 'Allergies',
    current_medications: 'Current Medications',
    print_prescription: 'Print / Download Prescription',
    change_password: 'Change Password',
    current_password: 'Current Password',
    new_password: 'New Password',
    confirm_password: 'Confirm Password',
    health_centre: 'Health Centre',
    location: 'Location',
    status_pending: 'Pending',
    status_confirmed: 'Confirmed',
    status_completed: 'Completed',
    status_cancelled: 'Cancelled',
    status_rejected: 'Rejected',
    meeting_scheduled: 'Scheduled',
    meeting_waiting_doctor: 'Waiting for Doctor',
    meeting_waiting_patient: 'Waiting for Patient',
    meeting_in_progress: 'In Progress'
  },
  Tamil: {
    video_call: 'வீடியோ அழைப்பு',
    voice_call: 'குரல் அழைப்பு',
    in_person: 'நேரடி வருகை',
    consultation_type: 'ஆலோசனை வகை',
    available_slots: 'கிடைக்கும் நேரங்கள்',
    book_for_patient: 'நோயாளிக்கு முன்பதிவு செய்',
    reschedule: 'தேதி/நேரம் மாற்று',
    patient_profile: 'நோயாளி சுயவிவரம்',
    medical_history: 'மருத்துவ வரலாறு',
    allergies: 'ஒவ்வாமைகள் (Allergies)',
    current_medications: 'தற்போதைய மருந்துகள்',
    print_prescription: 'மருந்துச் சீட்டை அச்சிடு / பதிவிறக்கு',
    change_password: 'கடவுச்சொல் மாற்று',
    current_password: 'தற்போதைய கடவுச்சொல்',
    new_password: 'புதிய கடவுச்சொல்',
    confirm_password: 'கடவுச்சொல்லை உறுதிப்படுத்து',
    health_centre: 'ஆரோக்கிய மையம்',
    location: 'இருப்பிடம்',
    status_pending: 'நிலுவையில்',
    status_confirmed: 'உறுதிசெய்யப்பட்டது',
    status_completed: 'முடிவுற்றது',
    status_cancelled: 'ரத்துசெய்யப்பட்டது',
    status_rejected: 'நிராகரிக்கப்பட்டது',
    meeting_scheduled: 'திட்டமிடப்பட்டது',
    meeting_waiting_doctor: 'மருத்துவருக்காக காத்திருக்கிறது',
    meeting_waiting_patient: 'நோயாளிக்காக காத்திருக்கிறது',
    meeting_in_progress: 'நடைபெறுகிறது'
  },
  Hindi: {
    video_call: 'वीडियो कॉल',
    voice_call: 'वॉइस कॉल',
    in_person: 'व्यक्तिगत परामर्श',
    consultation_type: 'परामर्श प्रकार',
    available_slots: 'उपलब्ध स्लॉट',
    book_for_patient: 'मरीज़ के लिए बुक करें',
    reschedule: 'समय पुनर्निर्धारित करें',
    patient_profile: 'मरीज़ प्रोफ़ाइल',
    medical_history: 'चिकित्सा इतिहास',
    allergies: 'एलर्जी (Allergies)',
    current_medications: 'वर्तमान दवाएं',
    print_prescription: 'पर्चा प्रिंट / डाउनलोड करें',
    change_password: 'पासवर्ड बदलें',
    current_password: 'वर्तमान पासवर्ड',
    new_password: 'नया पासवर्ड',
    confirm_password: 'पासवर्ड की पुष्टि करें',
    health_centre: 'स्वास्थ्य केंद्र',
    location: 'स्थान',
    status_pending: 'लंबित',
    status_confirmed: 'पुष्टीकृत',
    status_completed: 'पूर्ण',
    status_cancelled: 'रद्द',
    status_rejected: 'अस्वीकृत',
    meeting_scheduled: 'निर्धारित',
    meeting_waiting_doctor: 'डॉक्टर की प्रतीक्षा है',
    meeting_waiting_patient: 'मरीज़ की प्रतीक्षा है',
    meeting_in_progress: 'प्रगति पर है'
  },
  Telugu: {
    video_call: 'వీడియో కాల్',
    voice_call: 'వాయిస్ కాల్',
    in_person: 'ప్రత్యక్ష సంప్రదింపు',
    consultation_type: 'సంప్రదింపు రకం',
    available_slots: 'అందుబాటులో ఉన్న స్లాట్‌లు',
    book_for_patient: 'రోగి కోసం బుక్ చేయండి',
    reschedule: 'రీషెడ్యూల్ చేయండి',
    patient_profile: 'రోగి ప్రొఫైల్',
    medical_history: 'వైద్య చరిత్ర',
    allergies: 'అలర్జీలు (Allergies)',
    current_medications: 'ప్రస్తుత మందులు',
    print_prescription: 'ప్రిస్క్రిప్షన్ ప్రింట్ / డౌన్‌లోడ్',
    change_password: 'పాస్‌వర్డ్ మార్చండి',
    current_password: 'ప్రస్తుత పాస్‌వర్డ్',
    new_password: 'కొత్త పాస్‌వర్డ్',
    confirm_password: 'పాస్‌వర్డ్ నిర్ధారించండి',
    health_centre: 'ఆరోగ్య కేంద్రం',
    location: 'స్థానం',
    status_pending: 'పెండింగ్‌లో ఉంది',
    status_confirmed: 'ధృవీకరించబడింది',
    status_completed: 'పూర్తయింది',
    status_cancelled: 'రద్దు చేయబడింది',
    status_rejected: 'తిరస్కరించబడింది',
    meeting_scheduled: 'షెడ్యూల్ చేయబడింది',
    meeting_waiting_doctor: 'వైద్యుడి కోసం వేచి ఉంది',
    meeting_waiting_patient: 'రోగి కోసం వేచి ఉంది',
    meeting_in_progress: 'కొనసాగుతోంది'
  },
  Malayalam: {
    video_call: 'വീഡിയോ കോൾ',
    voice_call: 'വോയ്‌സ് കോൾ',
    in_person: 'നേരിട്ടുള്ള സന്ദർശനം',
    consultation_type: 'കൺസൾട്ടേഷൻ തരം',
    available_slots: 'ലഭ്യമായ സ്ലോട്ടുകൾ',
    book_for_patient: 'രോഗിക്കായി ബുക്ക് ചെയ്യുക',
    reschedule: 'മാറ്റി നിശ്ചയിക്കുക',
    patient_profile: 'രോഗിയുടെ വിവരങ്ങൾ',
    medical_history: 'ചികിത്സാ ചരിത്രം',
    allergies: 'അലർജികൾ (Allergies)',
    current_medications: 'ഇപ്പോഴത്തെ മരുന്നുകൾ',
    print_prescription: 'പ്രിസ്ക്രിപ്ഷൻ പ്രിന്റ് / ഡൗൺലോഡ്',
    change_password: 'പാസ്‌വേഡ് മാറ്റുക',
    current_password: 'ഇപ്പോഴത്തെ പാസ്‌വേഡ്',
    new_password: 'പുതിയ പാസ്‌വേഡ്',
    confirm_password: 'പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക',
    health_centre: 'ആരോഗ്യ കേന്ദ്രം',
    location: 'സ്ഥലം',
    status_pending: 'തീർച്ചപ്പെടുത്തിയിട്ടില്ല',
    status_confirmed: 'സ്ഥിരീകരിച്ചു',
    status_completed: 'പൂർത്തിയായി',
    status_cancelled: 'റദ്ദാക്കി',
    status_rejected: 'നിരസിച്ചു',
    meeting_scheduled: 'ഷെഡ്യൂൾ ചെയ്തു',
    meeting_waiting_doctor: 'ഡോക്ടറെ കാത്തിരിക്കുന്നു',
    meeting_waiting_patient: 'രോഗിയെ കാത്തിരിക്കുന്നു',
    meeting_in_progress: 'നടന്നുകൊണ്ടിരിക്കുന്നു'
  },
  Kannada: {
    video_call: 'ವೀಡಿಯೊ ಕರೆ',
    voice_call: 'ಧ್ವನಿ ಕರೆ',
    in_person: 'ನೇರ ಭೇಟಿ',
    consultation_type: 'ಸಮಾಲೋಚನೆ ಪ್ರಕಾರ',
    available_slots: 'ಲಭ್ಯವಿರುವ ಸಮಯಗಳು',
    book_for_patient: 'ರೋಗಿಗಾಗಿ ಬುಕ್ ಮಾಡಿ',
    reschedule: 'ಮರುಹೊಂದಿಸಿ',
    patient_profile: 'ರೋಗಿಯ ಪ್ರೊಫೈಲ್',
    medical_history: 'ವೈದ್ಯಕೀಯ ಇತಿಹಾಸ',
    allergies: 'ಅಲರ್ಜಿಗಳು (Allergies)',
    current_medications: 'ಪ್ರಸ್ತುತ ಔಷಧಿಗಳು',
    print_prescription: 'ಪ್ರಿಸ್ಕ್ರಿಪ್ಷನ್ ಮುದ್ರಿಸಿ / ಡೌನ್‌ಲೋಡ್',
    change_password: 'ಪಾಸ್‌ವರ್ಡ್ ಬದಲಾಯಿಸಿ',
    current_password: 'ಪ್ರಸ್ತುತ ಪಾಸ್‌ವರ್ಡ್',
    new_password: 'ಹೊಸ ಪಾಸ್‌ವರ್ಡ್',
    confirm_password: 'ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ',
    health_centre: 'ಆರೋಗ್ಯ ಕೇಂದ್ರ',
    location: 'ಸ್ಥಳ',
    status_pending: 'ಬಾಕಿಯಿದೆ',
    status_confirmed: 'ದೃಢೀಕರಿಸಲಾಗಿದೆ',
    status_completed: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    status_cancelled: 'ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ',
    status_rejected: 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ',
    meeting_scheduled: 'ನಿಗದಿಪಡಿಸಲಾಗಿದೆ',
    meeting_waiting_doctor: 'ವೈದ್ಯರಿಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ',
    meeting_waiting_patient: 'ರೋಗಿಗಾಗಿ ಕಾಯಲಾಗುತ್ತಿದೆ',
    meeting_in_progress: 'ಪ್ರಗತಿಯಲ್ಲಿದೆ'
  }
};

let content = fs.readFileSync('client/src/translations.js', 'utf8');

// For each language, find its closing brace before the next language or end of TRANSLATIONS
// We can inject the extra keys just before each language's object closing
for (const [lang, keys] of Object.entries(extraTranslations)) {
  const marker = `${lang}: {`;
  const idx = content.indexOf(marker);
  if (idx !== -1) {
    // Find next language or end
    let searchFrom = idx + marker.length;
    let braceCount = 1;
    let endIdx = -1;
    for (let i = searchFrom; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      else if (content[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIdx = i;
          break;
        }
      }
    }
    if (endIdx !== -1) {
      const keysString = Object.entries(keys)
        .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`)
        .join('\n');
      content = content.slice(0, endIdx) + ',\n' + keysString + '\n  ' + content.slice(endIdx);
    }
  }
}

fs.writeFileSync('client/src/translations.js', content, 'utf8');
console.log('Successfully injected enhanced translations into client/src/translations.js');
