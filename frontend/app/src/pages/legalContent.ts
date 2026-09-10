/**
 * The Privacy Policy and Terms of Use, in both languages.
 *
 * Kept out of lib/i18n/dictionary.*, which every Hindi page loads: this is a
 * few thousand words that only matter on /privacy and /terms, and it lives in
 * the chunk those two routes already pull in.
 *
 * The English is the text as published and is not edited here. The Hindi is a
 * translation for readability — written by hand rather than run through the
 * content translator, because a policy citing the IT Act, the DPDP Act and
 * ASCI guidelines is not the place for a model to paraphrase. `prevails`
 * below says so on the page itself, which is the ordinary practice for a
 * translated legal document: the reader is told which version governs.
 */

export interface LegalBlock {
  /** Section heading, when this block starts one. */
  h?: string;
  p: string;
  /** Rendered uppercase in the source — the statutory warnings. */
  upper?: boolean;
}

export interface LegalDoc {
  title: string;
  blocks: LegalBlock[];
}

/** Shown only on the Hindi rendering. */
export const HINDI_PREVAILS =
  "यह अनुवाद केवल पढ़ने की सुविधा के लिए है। किसी भी अंतर या विवाद की स्थिति में इस दस्तावेज़ का अंग्रेज़ी संस्करण ही मान्य होगा।";

const privacyEn: LegalDoc = {
  title: "PRIVACY POLICY",
  blocks: [
    { p: `www.panditsuggest.com ("we", "PanditSuggest", "the Company", hereinafter referred to as "website") is committed to protect the privacy of the users of the website (including third party service providers, hereinafter referred to as 'pandits', and buyers/customers whether registered or not registered). Please read this privacy policy carefully to understand how the website is going to use your information supplied by you to the Website.` },
    { p: `This Privacy Policy is published in accordance with Section 43A of the Information Technology Act, 2000 read with Rule 3(1) of the Information Technology (Intermediaries Guidelines) Rules, 2011, Regulation 4 of the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data Protection Act, 2023 as applicable, which requires publishing of the Privacy policy for collection, use, storage, management, and transfer of sensitive personal data or information.` },
    { p: `We implement industry-standard security measures adhering to data protection and establishing a privacy policy to ensure the safe collection, use, storage, and transfer of your sensitive personal information. Users have rights to access, correct, or delete their personal data by contacting us, subject to applicable laws.` },
    { p: `PanditSuggest ensures that all advertising and promotional materials for religious and related services strictly adhere to the Advertising Standards Council of India (ASCI) guidelines and Consumer Protection Act, 2019. We provide clear disclaimers in all communications, stating that the religious services and advice provided through the platform are without guaranteed outcomes. PanditSuggest does not guarantee the accuracy of predictions, or the effectiveness of any services and all services are provided with full transparency, in line with the applicable laws.` },
    { h: "USER'S CONSENT", p: `This Privacy Policy, which may be updated/amended from time to time, deals with the information collected from its users in the form of personal identification, contact details, service preferences and any forecast made using the supplied information and how such information is further used for the purposes of the Website. By accessing the website and using it, you indicate that you understand the terms and expressly consent to the privacy policy of this website. If you do not agree with the terms of this privacy policy, please do not use this website.` },
    { h: "INFORMATION COLLECTED", p: `When you create an account, we collect your name, phone number, email address, and location data to provide relevant services. We also collect data regarding your usage of the platform to improve our services and AI recommendations. Your contact information is only shared with Pandits when you explicitly choose to contact or book them through our platform.` },
    { h: "GRIEVANCE REDRESSAL", p: `Any complaints or concerns with regards to content or to report any abuse of laws or breach of these terms may be taken up with the designated Grievance Officer as mentioned below via email to grievance@panditsuggest.com.` },
  ],
};

const privacyHi: LegalDoc = {
  title: "गोपनीयता नीति",
  blocks: [
    { p: `www.panditsuggest.com ("हम", "PanditSuggest", "कंपनी", आगे "वेबसाइट" कहा गया है) वेबसाइट के उपयोगकर्ताओं की निजता की रक्षा के लिए प्रतिबद्ध है — इसमें तृतीय-पक्ष सेवा प्रदाता (आगे 'पंडित' कहा गया है) और खरीदार/ग्राहक, चाहे पंजीकृत हों या नहीं, दोनों शामिल हैं। कृपया यह गोपनीयता नीति ध्यान से पढ़ें ताकि आप समझ सकें कि वेबसाइट आपके द्वारा दी गई जानकारी का उपयोग किस प्रकार करेगी।` },
    { p: `यह गोपनीयता नीति सूचना प्रौद्योगिकी अधिनियम, 2000 की धारा 43A, सूचना प्रौद्योगिकी (मध्यवर्ती दिशानिर्देश) नियम, 2011 के नियम 3(1), सूचना प्रौद्योगिकी (उचित सुरक्षा प्रथाएं एवं प्रक्रियाएं तथा संवेदनशील व्यक्तिगत डेटा या सूचना) नियम, 2011 के विनियम 4, तथा यथालागू डिजिटल व्यक्तिगत डेटा संरक्षण अधिनियम, 2023 के अनुसार प्रकाशित की गई है, जिनके अंतर्गत संवेदनशील व्यक्तिगत डेटा या सूचना के संग्रह, उपयोग, भंडारण, प्रबंधन और हस्तांतरण के लिए गोपनीयता नीति प्रकाशित करना आवश्यक है।` },
    { p: `हम आपकी संवेदनशील व्यक्तिगत जानकारी के सुरक्षित संग्रह, उपयोग, भंडारण और हस्तांतरण को सुनिश्चित करने के लिए डेटा संरक्षण के उद्योग-मानक सुरक्षा उपाय लागू करते हैं। लागू कानूनों के अधीन, उपयोगकर्ताओं को हमसे संपर्क करके अपने व्यक्तिगत डेटा तक पहुंचने, उसे सुधारने या हटाने का अधिकार है।` },
    { p: `PanditSuggest यह सुनिश्चित करता है कि धार्मिक एवं संबंधित सेवाओं की सभी विज्ञापन और प्रचार सामग्री भारतीय विज्ञापन मानक परिषद (ASCI) के दिशानिर्देशों तथा उपभोक्ता संरक्षण अधिनियम, 2019 का कड़ाई से पालन करे। हम अपने सभी संदेशों में स्पष्ट अस्वीकरण देते हैं कि मंच के माध्यम से दी जाने वाली धार्मिक सेवाएं और सलाह किसी परिणाम की गारंटी के बिना हैं। PanditSuggest किसी भविष्यवाणी की सटीकता या किसी सेवा की प्रभावशीलता की गारंटी नहीं देता, और सभी सेवाएं लागू कानूनों के अनुरूप पूरी पारदर्शिता के साथ दी जाती हैं।` },
    { h: "उपयोगकर्ता की सहमति", p: `यह गोपनीयता नीति, जिसे समय-समय पर अद्यतन/संशोधित किया जा सकता है, उपयोगकर्ताओं से एकत्र की गई जानकारी — व्यक्तिगत पहचान, संपर्क विवरण, सेवा प्राथमिकताएं तथा दी गई जानकारी के आधार पर किया गया कोई भी आकलन — और वेबसाइट के प्रयोजनों हेतु ऐसी जानकारी के आगे उपयोग से संबंधित है। वेबसाइट तक पहुंच बनाकर और उसका उपयोग करके आप यह दर्शाते हैं कि आप इन शर्तों को समझते हैं और इस वेबसाइट की गोपनीयता नीति से स्पष्ट रूप से सहमत हैं। यदि आप इस गोपनीयता नीति की शर्तों से सहमत नहीं हैं, तो कृपया इस वेबसाइट का उपयोग न करें।` },
    { h: "एकत्र की जाने वाली जानकारी", p: `जब आप खाता बनाते हैं, तो प्रासंगिक सेवाएं देने के लिए हम आपका नाम, फ़ोन नंबर, ईमेल पता और स्थान संबंधी जानकारी एकत्र करते हैं। अपनी सेवाओं और AI सुझावों को बेहतर बनाने के लिए हम मंच के आपके उपयोग से जुड़ा डेटा भी एकत्र करते हैं। आपकी संपर्क जानकारी पंडितों के साथ केवल तभी साझा की जाती है जब आप स्वयं हमारे मंच के माध्यम से उनसे संपर्क करना चुनते हैं।` },
    { h: "शिकायत निवारण", p: `सामग्री से संबंधित कोई शिकायत या चिंता, अथवा किसी कानून के उल्लंघन या इन शर्तों के हनन की सूचना, नीचे उल्लिखित नामित शिकायत अधिकारी को grievance@panditsuggest.com पर ईमेल द्वारा दी जा सकती है।` },
  ],
};

const termsEn: LegalDoc = {
  title: "TERMS AND CONDITIONS OF USAGE",
  blocks: [
    { p: `This website is owned and operated by PanditSuggest ("us" "We", "the Company" or "PanditSuggest" which also includes its affiliates) (contact@panditsuggest.com). The Platform may be provided or be accessible via multiple websites or applications whether owned and/or operated by us or by third parties, including, without limitation, the website panditsuggest.com and its related apps.` },
    { p: `Following Terms and Conditions (the "Agreement") govern your access and use of our online platform through which consulting, information related to Hindu Rituals, Pujas, Havans, and other allied spiritual services (collectively, the "Spiritual Advisory Services") are administered and accessible to any person.` },
    { p: `By accessing or using the Platform, you are entering into this Agreement. You should read this Agreement carefully before starting to use the Platform. If you do not agree to be bound to any term of this Agreement, you must not access the Platform.` },
    { p: `When the terms "we", "us", "our" or similar are used in this Agreement, they refer to any company that owns and operates the Platform (the "Company").` },
    { upper: true, p: `If you are thinking about harming yourself or others or if you feel that any other person may be in any danger or if you have any medical emergency, you must immediately call the police or a suicide prevention helpline. The platform is not designed for use in any of the aforementioned cases and the service providers cannot provide the assistance required in any of the aforementioned cases. If you proceed to use the platform notwithstanding this notice, you do so entirely at your own risk.` },
    { upper: true, p: `The platform is not intended for the provision of clinical diagnosis requiring an in-person evaluation. It is also not intended for any information regarding which drugs or medical treatment may be appropriate for you, and you should disregard any such advice if delivered through the platform.` },
    { upper: true, p: `Do not disregard, avoid, or delay in obtaining in-person care from your doctor or other qualified professional because of information or advice you received through the platform.` },
    { h: "ZERO-COMMISSION AND INTERMEDIARY ROLE", p: `PanditSuggest operates strictly as an online directory and discovery platform. We facilitate the connection between Devotees and Pandits. We do not employ Pandits, nor do we perform, guarantee, or take responsibility for any Pujas, Havans, or religious ceremonies. We operate on a zero-commission model, meaning we do not take a cut from the fees agreed upon between you and the Pandit. All financial transactions occur directly and exclusively between the Devotee and the Pandit.` },
    { h: "LIMITATION OF LIABILITY", p: `The Platform and its content are provided on an "as is" and "as available" basis. While we strive to verify profiles through our KYC process, PanditSuggest makes no warranties, express or implied, regarding the accuracy, reliability, or spiritual efficacy of the services provided by the Pandits listed on our platform. To the maximum extent permitted by Indian Law, PanditSuggest shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising out of your use of the Platform or any interactions/transactions between you and any third party found through the Platform.` },
  ],
};

const termsHi: LegalDoc = {
  title: "उपयोग की शर्तें",
  blocks: [
    { p: `यह वेबसाइट PanditSuggest ("हम", "कंपनी" या "PanditSuggest", जिसमें इसकी सहयोगी संस्थाएं भी शामिल हैं) द्वारा स्वामित्व में रखी और संचालित की जाती है (contact@panditsuggest.com)। यह मंच एक से अधिक वेबसाइटों या ऐप्लिकेशनों के माध्यम से उपलब्ध हो सकता है, चाहे वे हमारे स्वामित्व/संचालन में हों या तृतीय पक्षों के — जिनमें panditsuggest.com वेबसाइट और उससे जुड़े ऐप शामिल हैं, किंतु इन्हीं तक सीमित नहीं।` },
    { p: `निम्नलिखित नियम एवं शर्तें ("अनुबंध") हमारे ऑनलाइन मंच तक आपकी पहुंच और उपयोग को नियंत्रित करती हैं, जिसके माध्यम से हिंदू अनुष्ठानों, पूजा, हवन तथा अन्य संबंधित आध्यात्मिक सेवाओं (सामूहिक रूप से "आध्यात्मिक परामर्श सेवाएं") से जुड़ी जानकारी और परामर्श किसी भी व्यक्ति को उपलब्ध कराए जाते हैं।` },
    { p: `मंच तक पहुंच बनाकर या उसका उपयोग करके आप इस अनुबंध में प्रवेश कर रहे हैं। मंच का उपयोग शुरू करने से पहले आपको यह अनुबंध ध्यानपूर्वक पढ़ लेना चाहिए। यदि आप इस अनुबंध की किसी भी शर्त से बंधने के लिए सहमत नहीं हैं, तो आपको मंच तक पहुंच नहीं बनानी चाहिए।` },
    { p: `इस अनुबंध में जब "हम", "हमारा" या इसी प्रकार के शब्दों का प्रयोग किया गया है, तो उनका आशय उस कंपनी से है जो इस मंच की स्वामी है और उसे संचालित करती है ("कंपनी")।` },
    { upper: true, p: `यदि आप स्वयं को या किसी और को हानि पहुंचाने का विचार कर रहे हैं, या आपको लगता है कि कोई अन्य व्यक्ति ख़तरे में हो सकता है, या आपके सामने कोई चिकित्सीय आपात स्थिति है, तो आपको तुरंत पुलिस या आत्महत्या रोकथाम हेल्पलाइन को फ़ोन करना चाहिए। यह मंच उपरोक्त में से किसी भी स्थिति में उपयोग के लिए नहीं बनाया गया है और सेवा प्रदाता ऐसी स्थितियों में आवश्यक सहायता नहीं दे सकते। इस सूचना के बावजूद यदि आप मंच का उपयोग करते हैं, तो यह पूर्णतः आपके अपने जोखिम पर होगा।` },
    { upper: true, p: `यह मंच ऐसे नैदानिक निदान के लिए नहीं है जिसके लिए व्यक्तिगत रूप से जांच आवश्यक हो। यह इस बारे में जानकारी देने के लिए भी नहीं है कि आपके लिए कौन सी दवा या चिकित्सा उपयुक्त होगी, और यदि ऐसी कोई सलाह मंच के माध्यम से दी जाए तो आपको उसे नहीं मानना चाहिए।` },
    { upper: true, p: `मंच के माध्यम से मिली किसी जानकारी या सलाह के कारण अपने चिकित्सक या किसी अन्य योग्य पेशेवर से व्यक्तिगत रूप से मिलकर उपचार लेने की उपेक्षा न करें, उससे बचें नहीं, और उसमें देरी न करें।` },
    { h: "शून्य-कमीशन और मध्यवर्ती की भूमिका", p: `PanditSuggest पूर्णतः एक ऑनलाइन निर्देशिका एवं खोज मंच के रूप में कार्य करता है। हम भक्तों और पंडितों के बीच संपर्क को सुगम बनाते हैं। हम न तो पंडितों को नियोजित करते हैं, न ही किसी पूजा, हवन या धार्मिक अनुष्ठान को स्वयं करते हैं, उसकी गारंटी देते हैं या उसकी ज़िम्मेदारी लेते हैं। हम शून्य-कमीशन मॉडल पर चलते हैं, अर्थात आपके और पंडित जी के बीच तय हुई दक्षिणा में से हम कोई हिस्सा नहीं लेते। सभी आर्थिक लेन-देन सीधे और केवल भक्त तथा पंडित जी के बीच होते हैं।` },
    { h: "दायित्व की सीमा", p: `यह मंच और इसकी सामग्री "जैसी है" और "जैसी उपलब्ध है" के आधार पर दी जाती है। यद्यपि हम अपनी KYC प्रक्रिया के माध्यम से प्रोफ़ाइलों को सत्यापित करने का प्रयास करते हैं, PanditSuggest हमारे मंच पर सूचीबद्ध पंडितों द्वारा दी जाने वाली सेवाओं की सटीकता, विश्वसनीयता या आध्यात्मिक प्रभावशीलता के संबंध में कोई स्पष्ट या निहित आश्वासन नहीं देता। भारतीय कानून द्वारा अनुमत अधिकतम सीमा तक, मंच के आपके उपयोग अथवा मंच के माध्यम से मिले किसी तृतीय पक्ष के साथ आपके किसी संवाद/लेन-देन से उत्पन्न किसी भी प्रत्यक्ष, अप्रत्यक्ष, आनुषंगिक, परिणामी या दंडात्मक क्षति के लिए PanditSuggest उत्तरदायी नहीं होगा।` },
  ],
};

export const LEGAL = {
  privacy: { en: privacyEn, hi: privacyHi },
  terms: { en: termsEn, hi: termsHi },
};
