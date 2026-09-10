/* Content for the Online Havan & Puja page (/online-havan).
 *
 * Static, like havanStructure.ts and serviceMeta.ts, and for the same reason:
 * there is no column behind any of it. This is editorial explanation of how a
 * remote havan is actually performed — the ritual order, what a devotee must
 * supply, what reaches them afterwards — not catalogue data an admin edits.
 *
 * BILINGUAL SHAPE — deliberately different from havanStructure's parallel
 * `hi` block. There the Hindi arrived after the English and had to degrade
 * field by field; here both languages are written together, so every string
 * is an { en, hi } pair. A missing translation is then a type error at the
 * point it is written rather than an English sentence that quietly survives
 * into a Hindi page.
 *
 * SOURCING — the ritual order, samagri, mantra, ahuti counts, muhurat and the
 * remote-participation mechanics below follow how the Nalkheda Maa Baglamukhi
 * Siddha Peeth tradition is publicly described (Bagalamukhi havan vidhi
 * guides, Nalkheda temple and online-puja seva pages, temple listings).
 * Traditions vary between acharyas, which is exactly why every tier here ends
 * at "your acharya decides the count" rather than at a fixed promise, and why
 * benefits are worded as devotional intent — never as a legal, medical or
 * financial outcome.
 */

/** One string in both languages. */
export interface L {
  en: string;
  hi: string;
}

export type Lang = "en" | "hi";

/** The reader's language, English as the fallback for an unknown code. */
export function pick(l: L, lang: string): string {
  return lang === "hi" ? l.hi : l.en;
}

/** Same, for a list. */
export function pickAll(list: L[], lang: string): string[] {
  return list.map((l) => pick(l, lang));
}

/* ═══════════════════════════════════════════════════════════════
   1. What an online havan actually is — three honest columns
   ═══════════════════════════════════════════════════════════════ */

export interface Pillar {
  id: string;
  icon: string;
  title: L;
  text: L;
  points: L[];
}

export const PILLARS: Pillar[] = [
  {
    id: "temple",
    icon: "🔥",
    title: {
      en: "At the temple — the real fire",
      hi: "मंदिर में — असली अग्नि",
    },
    text: {
      en: "Nothing about the ritual is virtual. A pandit sits at a physical havan kund, the samagri is really offered, the fire really burns.",
      hi: "अनुष्ठान का कोई भी हिस्सा वर्चुअल नहीं होता। पंडित जी असली हवन कुंड के सामने बैठते हैं, सामग्री सचमुच अर्पित होती है, अग्नि सचमुच प्रज्वलित होती है।",
    },
    points: [
      { en: "Havan kund prepared and faced east", hi: "हवन कुंड की स्थापना, मुख पूर्व दिशा में" },
      { en: "Every ahuti offered in your name and gotra", hi: "हर आहुति आपके नाम और गोत्र से" },
      { en: "Full samagri — haldi ki lakdi, peeli sarson, desi ghee", hi: "पूरी सामग्री — हल्दी की लकड़ी, पीली सरसों, देसी घी" },
    ],
  },
  {
    id: "home",
    icon: "🪔",
    title: {
      en: "At your home — you, present",
      hi: "आपके घर पर — आपकी उपस्थिति",
    },
    text: {
      en: "You are not a spectator. At the sankalp your name, your father's name, gotra and city are spoken aloud into the fire — that is the moment the ritual is tied to you.",
      hi: "आप केवल दर्शक नहीं हैं। संकल्प के समय आपका नाम, पिता का नाम, गोत्र और नगर अग्नि के समक्ष बोले जाते हैं — यही वह क्षण है जब अनुष्ठान आपसे जुड़ता है।",
    },
    points: [
      { en: "Join live on WhatsApp video, Zoom or Google Meet", hi: "व्हाट्सएप वीडियो, ज़ूम या गूगल मीट पर लाइव जुड़ें" },
      { en: "Yellow clothes, a lit diya, face east", hi: "पीले वस्त्र, एक जलता दीपक, मुख पूर्व की ओर" },
      { en: "Hands folded through the sankalp and purnahuti", hi: "संकल्प और पूर्णाहुति के समय हाथ जोड़कर बैठें" },
    ],
  },
  {
    id: "after",
    icon: "📿",
    title: {
      en: "After — what reaches your door",
      hi: "उसके बाद — जो आपके द्वार तक पहुँचता है",
    },
    text: {
      en: "The fire leaves something behind. Bhasma from your own havan kund, the raksha sutra tied during the ritual, and the recording of the sankalp spoken in your name.",
      hi: "अग्नि अपने पीछे कुछ छोड़ जाती है। आपके ही हवन कुंड की भस्म, अनुष्ठान में बाँधा गया रक्षा-सूत्र, और आपके नाम से बोले गए संकल्प की रिकॉर्डिंग।",
    },
    points: [
      { en: "Havan bhasma, raksha sutra, energised yantra", hi: "हवन भस्म, रक्षा-सूत्र, अभिमंत्रित यंत्र" },
      { en: "Prasad couriered — 7–10 days, worldwide", hi: "प्रसाद कूरियर द्वारा — 7–10 दिन, विश्व भर में" },
      { en: "Full HD recording and photographs", hi: "पूरी एचडी रिकॉर्डिंग और छायाचित्र" },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════
   2. The ritual day, hour by hour — the page's centrepiece

   Read AFTER the journey above, never instead of it: this is how the
   tradition is generally performed, not an instruction sheet. Every
   `you` field below therefore defers to the Pandit Ji the devotee has
   already spoken to — the page describes, the acharya instructs, and
   where the two differ the acharya is right.
   ═══════════════════════════════════════════════════════════════ */

export interface RitualStep {
  id: string;
  /** Clock label as it is spoken to a devotee, not a machine time. */
  time: L;
  name: L;
  /** Sanskrit/Hindi name of the step, shown as the eyebrow. */
  sanskrit: L;
  /** What happens at the kund. */
  pandit: L;
  /** What the devotee does at that same minute, at home. */
  you: L;
  /** The mantra of that step, Devanagari with a roman line under it. */
  mantra?: { dev: string; roman: string };
  /** A number worth showing big — ahuti count, japa count, repetitions. */
  count?: { value: string; label: L };
  /** Is the devotee expected on the call for this step? */
  live?: boolean;
}

export const RITUAL_DAY: RitualStep[] = [
  {
    id: "brahma-muhurat",
    time: { en: "4:00 – 6:00 AM", hi: "प्रातः 4:00 – 6:00" },
    sanskrit: { en: "Brahma Muhurat · Shuddhi", hi: "ब्रह्म मुहूर्त · शुद्धि" },
    name: { en: "Bathing and purification", hi: "स्नान एवं शुद्धिकरण" },
    pandit: {
      en: "The acharya bathes before sunrise and wears yellow. The havan shala is washed, the kund's inner walls are coated with turmeric paste, and the altar is laid with yellow cloth and the Baglamukhi yantra.",
      hi: "आचार्य सूर्योदय से पूर्व स्नान कर पीले वस्त्र धारण करते हैं। हवन शाला की धुलाई होती है, कुंड की भीतरी दीवारों पर हल्दी का लेप किया जाता है, और वेदी पर पीला वस्त्र एवं बगलामुखी यंत्र स्थापित किए जाते हैं।",
    },
    you: {
      en: "Whatever Pandit Ji told you the day before — usually a bath before the call, yellow or clean light clothes, and a clean quiet corner to sit in. Nothing is expected of you on camera yet.",
      hi: "जो पंडित जी ने एक दिन पूर्व बताया हो — प्रायः कॉल से पहले स्नान, पीले या स्वच्छ हल्के वस्त्र, और बैठने के लिए एक स्वच्छ व शांत कोना। इस समय आपसे कैमरे पर कुछ अपेक्षित नहीं है।",
    },
  },
  {
    id: "sthapana",
    time: { en: "6:00 – 6:30 AM", hi: "प्रातः 6:00 – 6:30" },
    sanskrit: { en: "Havan Kund Sthapana", hi: "हवन कुंड स्थापना" },
    name: { en: "The kund is set and the fire prepared", hi: "कुंड की स्थापना एवं अग्नि की तैयारी" },
    pandit: {
      en: "Mango wood is laid as the base fuel and turmeric wood — haldi ki lakdi — above it. In this tradition the turmeric wood is not optional; it is the fuel the havan is named for. Ghee, peeli sarson, yellow flowers and the samagri thalis are arranged within arm's reach.",
      hi: "आधार ईंधन के रूप में आम की लकड़ी और उसके ऊपर हल्दी की लकड़ी रखी जाती है। इस परंपरा में हल्दी की लकड़ी वैकल्पिक नहीं है — यही वह ईंधन है जिससे यह हवन पहचाना जाता है। घी, पीली सरसों, पीले पुष्प और सामग्री की थालियाँ पास ही सजाई जाती हैं।",
    },
    you: {
      en: "If Pandit Ji has asked for it, set a small thali beside you — a diya, a few yellow flowers, some rice and water. It is not a parallel puja; it is so your hands have something to offer at the aarti.",
      hi: "यदि पंडित जी ने कहा हो तो अपने पास एक छोटी थाली रखें — एक दीपक, कुछ पीले पुष्प, थोड़े चावल और जल। यह अलग पूजा नहीं है; यह इसलिए है कि आरती के समय आपके हाथों में अर्पित करने को कुछ हो।",
    },
  },
  {
    id: "achaman",
    time: { en: "6:30 AM", hi: "प्रातः 6:30" },
    sanskrit: { en: "Achaman · Pranayam", hi: "आचमन · प्राणायाम" },
    name: { en: "Water sipped, breath steadied", hi: "आचमन एवं प्राणायाम" },
    pandit: {
      en: "Water is sipped three times and three rounds of pranayama are done, so that the voice that is about to carry your name is steady before it does.",
      hi: "तीन बार जल का आचमन और तीन आवृत्ति प्राणायाम किया जाता है, ताकि जो स्वर आपका नाम अग्नि तक ले जाने वाला है, वह पहले स्थिर हो जाए।",
    },
    you: {
      en: "Sit down now if you have joined. Phone charged, on a stand, in silent — you should not be holding it when the sankalp begins.",
      hi: "यदि आप जुड़ चुके हैं तो अब बैठ जाएँ। फ़ोन चार्ज हो, स्टैंड पर हो, साइलेंट पर हो — संकल्प के समय वह आपके हाथ में नहीं होना चाहिए।",
    },
    count: { value: "3", label: { en: "rounds", hi: "आवृत्ति" } },
  },
  {
    id: "ganesh",
    time: { en: "6:40 AM", hi: "प्रातः 6:40" },
    sanskrit: { en: "Ganesh · Navagraha Pujan", hi: "गणेश · नवग्रह पूजन" },
    name: { en: "Ganesh ji first, then the nine grahas", hi: "प्रथम गणेश पूजन, फिर नवग्रह" },
    pandit: {
      en: "No fire ritual begins with the deity it is meant for. Ganesh ji is invoked first with sesame and ghee, then the Navagraha and Pancha Devata with rice mixed with turmeric — obstacles are cleared before an obstacle-clearing goddess is called.",
      hi: "कोई भी अग्नि-अनुष्ठान अपने मुख्य देवता से आरंभ नहीं होता। पहले तिल और घी से गणेश जी का आवाहन होता है, फिर हल्दी मिश्रित अक्षत से नवग्रह एवं पंचदेवता का — विघ्नहर्ता देवी के आवाहन से पूर्व विघ्नों का शमन किया जाता है।",
    },
    you: {
      en: "Fold your hands. If you know it, say the Ganesh mantra along with the acharya — softly, in your own room.",
      hi: "हाथ जोड़ लें। यदि आपको आता हो तो आचार्य के साथ गणेश मंत्र का उच्चारण करें — धीमे स्वर में, अपने कक्ष में।",
    },
    mantra: { dev: "ॐ गं गणपतये नमः", roman: "Om Gam Ganapataye Namah" },
    count: { value: "5", label: { en: "ahuti", hi: "आहुति" } },
  },
  {
    id: "avahan",
    time: { en: "7:00 AM", hi: "प्रातः 7:00" },
    sanskrit: { en: "Kalash Sthapana · Devi Avahan", hi: "कलश स्थापना · देवी आवाहन" },
    name: { en: "The kalash is set, Maa is invoked", hi: "कलश स्थापना एवं माँ का आवाहन" },
    pandit: {
      en: "The kalash is established and Maa Baglamukhi is formally invoked with her Gayatri, recited twenty-one times. At Nalkheda the invocation is made before the triad in the sanctum — Baglamukhi at the centre, with Lakshmi and Saraswati at her sides.",
      hi: "कलश की स्थापना कर माँ बगलामुखी का विधिवत आवाहन उनकी गायत्री से किया जाता है, जिसका इक्कीस बार पाठ होता है। नलखेड़ा में यह आवाहन गर्भगृह की त्रयी के समक्ष होता है — मध्य में बगलामुखी, दोनों ओर लक्ष्मी और सरस्वती।",
    },
    you: {
      en: "This is usually the first thing you see when the video connects. Take darshan properly — do not scroll, do not put the call on speaker in a noisy room.",
      hi: "वीडियो जुड़ने पर प्रायः सबसे पहले यही दृश्य आता है। ठीक से दर्शन करें — स्क्रॉल न करें, शोरगुल वाले कमरे में स्पीकर पर कॉल न रखें।",
    },
    mantra: {
      dev: "ॐ बगलामुखी विद्महे स्तम्भिन्यै धीमहि। तन्नो देवी प्रचोदयात्॥",
      roman: "Om Baglamukhi Vidmahe Stambhinyai Dhimahi | Tanno Devi Prachodayat",
    },
    count: { value: "21", label: { en: "recitations", hi: "पाठ" } },
    live: true,
  },
  {
    id: "sankalp",
    time: { en: "7:20 AM", hi: "प्रातः 7:20" },
    sanskrit: { en: "Sankalp", hi: "संकल्प" },
    name: { en: "Your name enters the ritual", hi: "अनुष्ठान में आपका नाम" },
    pandit: {
      en: "The acharya holds water, rice and a yellow flower in his palm and speaks the sankalp aloud: the day and tithi, then your gotra, your name, your father's name and your city, and finally the purpose you came with. He then releases it into the kund. Everything offered after this minute is offered on your behalf.",
      hi: "आचार्य हथेली में जल, अक्षत और एक पीला पुष्प लेकर संकल्प का उच्चारण करते हैं: तिथि और दिन, फिर आपका गोत्र, आपका नाम, पिता का नाम और नगर, और अंत में वह उद्देश्य जिसके लिए आप आए हैं। तत्पश्चात वे उसे कुंड में छोड़ देते हैं। इस क्षण के बाद अर्पित प्रत्येक वस्तु आपकी ओर से अर्पित होती है।",
    },
    you: {
      en: "Be on the call for this step if you are on it for nothing else — Pandit Ji tells you its time in advance for exactly that reason. Sit facing east, hands folded, and listen for your own name and gotra. Hearing them spoken correctly is how you verify the ritual is yours.",
      hi: "यदि किसी एक चरण पर उपस्थित रहना हो तो वह यही है — पंडित जी इसी कारण इसका समय पहले ही बता देते हैं। पूर्वाभिमुख होकर, हाथ जोड़कर बैठें और अपना नाम व गोत्र सुनें। उन्हें शुद्ध रूप से सुनना ही इस बात का प्रमाण है कि यह अनुष्ठान आपका है।",
    },
    live: true,
  },
  {
    id: "japa",
    time: { en: "7:30 AM onwards", hi: "प्रातः 7:30 से आगे" },
    sanskrit: { en: "Mool Mantra Japa", hi: "मूल मंत्र जप" },
    name: { en: "The japa — the long part", hi: "जप — सबसे दीर्घ चरण" },
    pandit: {
      en: "The mool mantra is repeated to the count your sankalp was taken for: 1,100 or 5,100 for a single-day havan, 36,000 upward for an anushthan, and 1,25,000 for a maha anushthan — which no one completes in a day and which runs nine to eleven days with a team of Vedic brahmins.",
      hi: "मूल मंत्र का जप उसी संख्या में होता है जिसके लिए आपका संकल्प लिया गया: एक दिवसीय हवन हेतु 1,100 या 5,100, अनुष्ठान हेतु 36,000 से ऊपर, और महा अनुष्ठान हेतु 1,25,000 — जो एक दिन में पूर्ण नहीं होता और वैदिक ब्राह्मणों के समूह द्वारा नौ से ग्यारह दिन तक चलता है।",
    },
    you: {
      en: "You are not expected to sit through all of it, and no honest pandit will ask you to. Most devotees leave the call here and rejoin for the ahuti. If you want to participate, chant the same mantra on a mala at your own pace.",
      hi: "आपसे पूरा जप बैठकर सुनने की अपेक्षा नहीं है, और कोई सच्चा पंडित यह कहेगा भी नहीं। अधिकांश भक्त यहाँ कॉल छोड़ देते हैं और आहुति के समय पुनः जुड़ते हैं। यदि आप सहभागी होना चाहें तो उसी मंत्र का जप अपनी गति से माला पर करें।",
    },
    mantra: {
      dev: "ॐ ह्लीं बगलामुखी सर्वदुष्टानां वाचं मुखं पदं स्तम्भय जिह्वां कीलय बुद्धिं विनाशय ह्लीं ॐ स्वाहा॥",
      roman: "Om Hleem Baglamukhi Sarvadushtanam Vacham Mukham Padam Stambhaya Jihvam Keelaya Buddhim Vinashaya Hleem Om Swaha",
    },
    count: { value: "1,25,000", label: { en: "japa · maha anushthan", hi: "जप · महा अनुष्ठान" } },
  },
  {
    id: "ahuti",
    time: { en: "Late morning", hi: "पूर्वाह्न के अंत में" },
    sanskrit: { en: "Homa · Ahuti", hi: "हवन · आहुति" },
    name: { en: "The offerings into the fire", hi: "अग्नि में आहुतियाँ" },
    pandit: {
      en: "Ahuti after ahuti, roughly one every twenty to thirty seconds, each with the full mool mantra and each ending in swaha. Ghee, peeli sarson, turmeric and the samagri mix go in every time. A minimum of 108; 1,008 for a sankalp taken over a serious matter.",
      hi: "एक के बाद एक आहुति, लगभग हर बीस-तीस सेकंड में एक, प्रत्येक के साथ पूरा मूल मंत्र और अंत में 'स्वाहा'। घी, पीली सरसों, हल्दी और सामग्री का मिश्रण हर बार अर्पित होता है। न्यूनतम 108; किसी गंभीर विषय के संकल्प हेतु 1,008।",
    },
    you: {
      en: "Rejoin the call. Each time you hear swaha, offer a pinch of rice or a flower from your thali into your own diya's plate. Do not light a fire at home unless your acharya has told you to.",
      hi: "कॉल पर पुनः जुड़ें। जब भी 'स्वाहा' सुनें, अपनी थाली से एक चुटकी अक्षत या एक पुष्प अपने दीपक की तश्तरी में अर्पित करें। जब तक आचार्य न कहें, घर पर अग्नि प्रज्वलित न करें।",
    },
    mantra: { dev: "इदं माँ बगलामुख्यै, इदं न मम — स्वाहा॥", roman: "Idam Maa Baglamukhyai, Idam Na Mama — Swaha" },
    count: { value: "1,008", label: { en: "ahuti · full anushthan", hi: "आहुति · पूर्ण अनुष्ठान" } },
    live: true,
  },
  {
    id: "purnahuti",
    time: { en: "Midday", hi: "मध्याह्न" },
    sanskrit: { en: "Purnahuti", hi: "पूर्णाहुति" },
    name: { en: "The final offering", hi: "अंतिम आहुति" },
    pandit: {
      en: "A whole dry coconut, makhana, the remaining ghee, honey and yellow flowers go in together as one closing offering. The fire is then left to die on its own — in this tradition it is never put out by hand.",
      hi: "समूचा सूखा नारियल, मखाना, शेष घी, मधु और पीले पुष्प एक साथ अंतिम आहुति के रूप में अर्पित किए जाते हैं। तत्पश्चात अग्नि को स्वयं शांत होने दिया जाता है — इस परंपरा में उसे कभी हाथ से नहीं बुझाया जाता।",
    },
    you: {
      en: "Stand if you can, hands folded, until the acharya says the purnahuti is complete. Devotees often report this as the part of the call they remember.",
      hi: "यदि संभव हो तो हाथ जोड़कर खड़े रहें, जब तक आचार्य पूर्णाहुति पूर्ण होने की घोषणा न करें। भक्त प्रायः कहते हैं कि पूरी कॉल में यही क्षण उन्हें स्मरण रहता है।",
    },
    live: true,
  },
  {
    id: "aarti",
    time: { en: "After the fire settles", hi: "अग्नि शांत होने पर" },
    sanskrit: { en: "Aarti · Bhasma Sangrah", hi: "आरती · भस्म संग्रह" },
    name: { en: "Aarti, ash and prasad", hi: "आरती, भस्म एवं प्रसाद" },
    pandit: {
      en: "Aarti is performed with a ghee lamp. Once the kund is cool the bhasma is collected and set aside in yellow cloth for you, the raksha sutra is offered at Maa's feet, and besan laddoo prasad is distributed at the temple.",
      hi: "घी के दीपक से आरती होती है। कुंड शीतल होने पर भस्म एकत्र कर आपके लिए पीले वस्त्र में रखी जाती है, रक्षा-सूत्र माँ के चरणों में अर्पित होता है, और मंदिर में बेसन के लड्डू का प्रसाद वितरित किया जाता है।",
    },
    you: {
      en: "Do your own aarti with the diya beside you, take the flame's warmth to your eyes, and take a little prasad from your home thali. Your bhasma packet is dispatched from here.",
      hi: "अपने पास रखे दीपक से आरती करें, ज्योति की ऊष्मा नेत्रों तक लें, और घर की थाली से थोड़ा प्रसाद ग्रहण करें। आपकी भस्म की पुड़िया यहीं से भेजी जाती है।",
    },
    live: true,
  },
];

/* ═══════════════════════════════════════════════════════════════
   3. Booking journey — sankalp to prasad, over days not hours
   ═══════════════════════════════════════════════════════════════ */

export interface JourneyStep {
  id: string;
  /** "Day −7", "Puja day" — relative, since no date is knowable here. */
  when: L;
  icon: string;
  title: L;
  text: L;
}

export const JOURNEY: JourneyStep[] = [
  {
    id: "find",
    when: { en: "Start here", hi: "यहाँ से आरंभ" },
    icon: "users",
    title: { en: "Find a verified Pandit Ji on PanditSuggest", hi: "PanditSuggest पर सत्यापित पंडित जी खोजें" },
    text: {
      en: "Open the list of Pandit Jis who perform this puja and read their profiles properly — credentials, years of practice, the languages they speak, what other devotees have written. A Baglamukhi anushthan is advanced practice, so the person matters more than the price.",
      hi: "इस पूजा को करने वाले पंडित जी की सूची खोलें और उनकी प्रोफ़ाइल ध्यान से पढ़ें — प्रमाण, अनुभव के वर्ष, वे कौन-सी भाषाएँ बोलते हैं, अन्य भक्तों ने क्या लिखा है। बगलामुखी अनुष्ठान उन्नत साधना है, इसलिए मूल्य से अधिक महत्व व्यक्ति का है।",
    },
  },
  {
    id: "talk",
    when: { en: "The same day", hi: "उसी दिन" },
    icon: "whatsapp",
    title: { en: "Call or WhatsApp them yourself", hi: "स्वयं कॉल या व्हाट्सएप करें" },
    text: {
      en: "Their number is on their profile and you speak to them directly — nothing is booked through PanditSuggest and we take no commission on your puja. Describe the situation in your own words, in your own language. This first conversation is where everything else gets decided.",
      hi: "उनका नंबर उनकी प्रोफ़ाइल पर है और आप सीधे उनसे बात करते हैं — PanditSuggest के माध्यम से कोई बुकिंग नहीं होती और आपकी पूजा पर हम कोई कमीशन नहीं लेते। अपनी स्थिति अपने शब्दों में, अपनी भाषा में बताएँ। यही पहली बातचीत है जिसमें आगे का सब कुछ तय होता है।",
    },
  },
  {
    id: "decide",
    when: { en: "Pandit Ji decides", hi: "पंडित जी निर्धारित करते हैं" },
    icon: "book-open",
    title: { en: "Pandit Ji decides the vidhi, the tier and the muhurat", hi: "पंडित जी विधि, स्तर और मुहूर्त तय करते हैं" },
    text: {
      en: "Standard samagri, twenty-one jadi-buti, or a multi-day anushthan; the japa count, the nyasa, the paddhati; and the date — a Tuesday, a Friday, an Ashtami, or one chosen against your birth details. Every one of those is their call to make after hearing you, not a dropdown's. Nalkheda dates are usually settled about a week ahead.",
      hi: "सामान्य सामग्री, इक्कीस जड़ी-बूटी, अथवा बहुदिवसीय अनुष्ठान; जप संख्या, न्यास, पद्धति; और तिथि — मंगलवार, शुक्रवार, अष्टमी, या आपकी जन्म-कुंडली देखकर चुनी गई। यह हर निर्णय आपकी बात सुनने के बाद उनका है, किसी ड्रॉपडाउन का नहीं। नलखेड़ा की तिथियाँ प्रायः एक सप्ताह पूर्व निश्चित होती हैं।",
    },
  },
  {
    id: "sankalp-details",
    when: { en: "When Pandit Ji asks", hi: "जब पंडित जी माँगें" },
    icon: "edit",
    title: { en: "You send the sankalp details they ask for", hi: "वे जो संकल्प-विवरण माँगें, आप भेजें" },
    text: {
      en: "Usually your full name, your father's name, gotra, rashi and nakshatra if you know them, your city, and the purpose in your own words. If your gotra is not known, send your father's and grandfather's names, your birth place and your family's native village — Pandit Ji will resolve it. Send exactly what they ask for and nothing to anyone else.",
      hi: "प्रायः आपका पूरा नाम, पिता का नाम, गोत्र, ज्ञात हो तो राशि और नक्षत्र, आपका नगर, और अपने शब्दों में उद्देश्य। गोत्र ज्ञात न हो तो पिता और दादा का नाम, जन्म स्थान और परिवार का मूल गाँव भेजें — पंडित जी निर्धारित कर देंगे। जो वे माँगें बस वही भेजें, और किसी और को कुछ नहीं।",
    },
  },
  {
    id: "prepare",
    when: { en: "Before the date", hi: "तिथि से पूर्व" },
    icon: "message-circle",
    title: { en: "Pandit Ji tells you what to do at home", hi: "पंडित जी बताते हैं घर पर क्या करना है" },
    text: {
      en: "What to wear, when to sit, whether to keep a diya or a fast, what to avoid eating, and which parts of the ritual you should be on the call for. Everything further down this page is how the tradition is generally described — but the instruction that actually applies to you is the one your Pandit Ji gives. Samagri is their side of it; you buy and arrange nothing.",
      hi: "क्या पहनना है, कब बैठना है, दीपक या व्रत रखना है या नहीं, क्या नहीं खाना, और अनुष्ठान के किन हिस्सों पर कॉल पर रहना है। इस पृष्ठ पर आगे जो कुछ है वह परंपरा का सामान्य वर्णन है — किंतु आप पर लागू होने वाला निर्देश वही है जो आपके पंडित जी दें। सामग्री उनका पक्ष है; आपको कुछ क्रय या व्यवस्थित नहीं करना।",
    },
  },
  {
    id: "link",
    when: { en: "On the day, morning", hi: "उस दिन, प्रातः" },
    icon: "video",
    title: { en: "Pandit Ji sends your live link", hi: "पंडित जी आपका लाइव लिंक भेजते हैं" },
    text: {
      en: "A WhatsApp video call, a Zoom link or a Meet link, with the time of your sankalp told to you in advance so you can be sitting when it happens rather than joining halfway through it.",
      hi: "व्हाट्सएप वीडियो कॉल, ज़ूम या मीट लिंक, और आपके संकल्प का समय पहले ही बता दिया जाता है ताकि आप उस क्षण बैठे हों, बीच में जुड़ें नहीं।",
    },
  },
  {
    id: "ritual",
    when: { en: "The day itself", hi: "वह दिन" },
    icon: "flame",
    title: { en: "The havan is performed", hi: "हवन सम्पन्न होता है" },
    text: {
      en: "Ganesh pujan, avahan, your sankalp, japa, ahuti, purnahuti, aarti — the same order, in the same number, as it would be if you were standing there. Photographs and short clips are usually sent through the day. The next section walks that day hour by hour.",
      hi: "गणेश पूजन, आवाहन, आपका संकल्प, जप, आहुति, पूर्णाहुति, आरती — वही क्रम, वही संख्या, जो आपके वहाँ उपस्थित होने पर होती। दिन भर छायाचित्र और लघु वीडियो प्रायः भेजे जाते हैं। अगला अनुभाग उसी दिन को घंटे-दर-घंटे दिखाता है।",
    },
  },
  {
    id: "prasad",
    when: { en: "Next 7–10 days", hi: "अगले 7–10 दिन" },
    icon: "heart",
    title: { en: "Bhasma and prasad are couriered", hi: "भस्म और प्रसाद कूरियर होते हैं" },
    text: {
      en: "Havan bhasma, raksha sutra, an energised yantra where your tier includes one, and prasad — dispatched to the address you gave Pandit Ji, in India or abroad, typically arriving within seven to ten days.",
      hi: "हवन भस्म, रक्षा-सूत्र, आपके स्तर में सम्मिलित हो तो अभिमंत्रित यंत्र, और प्रसाद — जो पता आपने पंडित जी को दिया, वहाँ भेजे जाते हैं, भारत में या विदेश में, प्रायः सात से दस दिनों में पहुँचते हैं।",
    },
  },
  {
    id: "after",
    when: { en: "Afterwards", hi: "तत्पश्चात" },
    icon: "check-circle",
    title: { en: "Pandit Ji gives you the niyam to keep", hi: "पंडित जी आगे का नियम देते हैं" },
    text: {
      en: "Most acharyas give a small daily practice afterwards — a mantra count, a Tuesday diya, the raksha sutra worn until it falls away on its own. Keep their number; the havan is the beginning of the sankalp, not the end of it.",
      hi: "अधिकांश आचार्य पश्चात एक छोटा नित्य नियम देते हैं — एक मंत्र संख्या, मंगलवार का दीपक, रक्षा-सूत्र जब तक स्वयं न उतरे तब तक धारण। उनका नंबर सुरक्षित रखें; हवन संकल्प का आरंभ है, अंत नहीं।",
    },
  },
];

/* ═══════════════════════════════════════════════════════════════
   4. What you do at home — and what you should not
   ═══════════════════════════════════════════════════════════════ */

export interface Rule {
  text: L;
}

export const DO_AT_HOME: Rule[] = [
  { text: { en: "Bathe before the call and wear yellow, or at least clean, light-coloured clothes", hi: "कॉल से पूर्व स्नान करें और पीले, अथवा कम से कम स्वच्छ हल्के रंग के वस्त्र पहनें" } },
  { text: { en: "Sit facing east, on a mat or asan, not on a bed or sofa", hi: "पूर्वाभिमुख होकर आसन या चटाई पर बैठें, पलंग या सोफ़े पर नहीं" } },
  { text: { en: "Keep a diya, yellow flowers, rice and water in a small thali beside you", hi: "पास एक छोटी थाली में दीपक, पीले पुष्प, अक्षत और जल रखें" } },
  { text: { en: "Eat only satvik food that day — and for two or three days before, if you can", hi: "उस दिन केवल सात्विक भोजन लें — और यदि संभव हो तो दो-तीन दिन पूर्व से" } },
  { text: { en: "Phone charged, on a stand, on silent, with a stable connection", hi: "फ़ोन चार्ज हो, स्टैंड पर हो, साइलेंट पर हो, और नेटवर्क स्थिर हो" } },
  { text: { en: "Be seated and listening at the sankalp — that is the one step you should not miss", hi: "संकल्प के समय बैठे और सुनते हुए रहें — यही वह चरण है जो छूटना नहीं चाहिए" } },
  { text: { en: "Keep the raksha sutra on until it comes off by itself", hi: "रक्षा-सूत्र तब तक धारण करें जब तक वह स्वयं न उतर जाए" } },
];

export const AVOID_AT_HOME: Rule[] = [
  { text: { en: "Do not light a havan fire at home alongside the call unless your acharya has told you to", hi: "जब तक आचार्य न कहें, कॉल के साथ घर पर हवन अग्नि प्रज्वलित न करें" } },
  { text: { en: "No onion, garlic, meat or alcohol on the day of the ritual", hi: "अनुष्ठान के दिन प्याज, लहसुन, मांस या मद्य नहीं" } },
  { text: { en: "Do not use red or white flowers — this worship is yellow throughout", hi: "लाल या श्वेत पुष्प प्रयोग न करें — यह पूजन आद्यंत पीत वर्ण का है" } },
  { text: { en: "Do not take the call while travelling, eating or lying down", hi: "यात्रा करते, भोजन करते या लेटे हुए कॉल पर न रहें" } },
  { text: { en: "Never let the sankalp be taken with intent to harm someone innocent", hi: "किसी निर्दोष को हानि पहुँचाने के भाव से संकल्प कभी न लें" } },
  { text: { en: "Do not pay a full advance to an unverified number that reached you first", hi: "जो अनजान नंबर स्वयं आप तक पहुँचा हो, उसे पूरी अग्रिम राशि न भेजें" } },
];

/* ═══════════════════════════════════════════════════════════════
   5. What reaches you
   ═══════════════════════════════════════════════════════════════ */

export interface Deliverable {
  icon: string;
  title: L;
  text: L;
}

export const DELIVERABLES: Deliverable[] = [
  {
    icon: "video",
    title: { en: "Live video of your sankalp", hi: "आपके संकल्प का लाइव वीडियो" },
    text: { en: "WhatsApp, Zoom or Meet — joined from anywhere in the world", hi: "व्हाट्सएप, ज़ूम या मीट — विश्व में कहीं से भी जुड़ें" },
  },
  {
    icon: "play-circle",
    title: { en: "Full HD recording", hi: "पूरी एचडी रिकॉर्डिंग" },
    text: { en: "The whole ritual, including your name being spoken", hi: "सम्पूर्ण अनुष्ठान, आपका नाम बोले जाने सहित" },
  },
  {
    icon: "flame",
    title: { en: "Havan bhasma", hi: "हवन भस्म" },
    text: { en: "Ash from your own kund, in yellow cloth", hi: "आपके ही कुंड की भस्म, पीले वस्त्र में" },
  },
  {
    icon: "shield-check",
    title: { en: "Raksha sutra", hi: "रक्षा-सूत्र" },
    text: { en: "Tied during the ritual and offered at Maa's feet", hi: "अनुष्ठान में बाँधा गया और माँ के चरणों में अर्पित" },
  },
  {
    icon: "om",
    title: { en: "Energised yantra", hi: "अभिमंत्रित यंत्र" },
    text: { en: "Where the tier you chose includes one", hi: "जहाँ आपके चुने स्तर में सम्मिलित हो" },
  },
  {
    icon: "package",
    title: { en: "Prasad to your door", hi: "प्रसाद आपके द्वार तक" },
    text: { en: "Couriered in India and overseas, usually 7–10 days", hi: "भारत और विदेश में कूरियर द्वारा, प्रायः 7–10 दिन" },
  },
];

/* ═══════════════════════════════════════════════════════════════
   6. Online vs standing there — said plainly
   ═══════════════════════════════════════════════════════════════ */

export interface CompareRow {
  aspect: L;
  online: L;
  inPerson: L;
  /** true where the two are genuinely identical. */
  same: boolean;
}

export const COMPARISON: CompareRow[] = [
  {
    aspect: { en: "Sankalp in your name and gotra", hi: "आपके नाम और गोत्र से संकल्प" },
    online: { en: "Spoken aloud, same words", hi: "उसी प्रकार उच्चारित, वही शब्द" },
    inPerson: { en: "Spoken aloud, same words", hi: "उसी प्रकार उच्चारित, वही शब्द" },
    same: true,
  },
  {
    aspect: { en: "Vidhi, mantra and ahuti count", hi: "विधि, मंत्र और आहुति संख्या" },
    online: { en: "Unchanged", hi: "अपरिवर्तित" },
    inPerson: { en: "Unchanged", hi: "अपरिवर्तित" },
    same: true,
  },
  {
    aspect: { en: "Who offers the ahuti", hi: "आहुति कौन देता है" },
    online: { en: "The acharya, as your pratinidhi", hi: "आचार्य, आपके प्रतिनिधि के रूप में" },
    inPerson: { en: "You, with your own hand", hi: "आप, अपने ही हाथ से" },
    same: false,
  },
  {
    aspect: { en: "Darshan of the sanctum", hi: "गर्भगृह के दर्शन" },
    online: { en: "On live video", hi: "लाइव वीडियो पर" },
    inPerson: { en: "In person", hi: "प्रत्यक्ष" },
    same: false,
  },
  {
    aspect: { en: "Temple-specific Nalkheda rites", hi: "नलखेड़ा की मंदिर-विशिष्ट विधियाँ" },
    online: { en: "Performed by the pandit at the site", hi: "स्थल पर पंडित जी द्वारा सम्पन्न" },
    inPerson: { en: "You participate directly", hi: "आप स्वयं सहभागी होते हैं" },
    same: false,
  },
  {
    aspect: { en: "Chola seva and offerings at the idol", hi: "चोला सेवा और प्रतिमा पर अर्पण" },
    online: { en: "Done on your behalf, shown on video", hi: "आपकी ओर से, वीडियो पर दिखाकर" },
    inPerson: { en: "By your own hand", hi: "आपके अपने हाथों से" },
    same: false,
  },
  {
    aspect: { en: "Prasad and bhasma", hi: "प्रसाद और भस्म" },
    online: { en: "Couriered, 7–10 days", hi: "कूरियर द्वारा, 7–10 दिन" },
    inPerson: { en: "In your hand the same day", hi: "उसी दिन आपके हाथ में" },
    same: false,
  },
  {
    aspect: { en: "Travel, stay and leave from work", hi: "यात्रा, ठहरना और अवकाश" },
    online: { en: "None", hi: "कुछ नहीं" },
    inPerson: { en: "Nalkheda, Agar Malwa, MP", hi: "नलखेड़ा, आगर मालवा, म.प्र." },
    same: false,
  },
];

/* ═══════════════════════════════════════════════════════════════
   7. Muhurat, samagri, and the temple itself
   ═══════════════════════════════════════════════════════════════ */

export interface MuhuratItem {
  label: L;
  detail: L;
  /** The strongest occasions get the filled treatment. */
  prime?: boolean;
}

export const MUHURAT: MuhuratItem[] = [
  { label: { en: "Tuesday", hi: "मंगलवार" }, detail: { en: "The primary day for Baglamukhi worship", hi: "बगलामुखी उपासना का प्रमुख दिन" }, prime: true },
  { label: { en: "Brahma Muhurat", hi: "ब्रह्म मुहूर्त" }, detail: { en: "4:00 – 6:00 AM, the most potent window", hi: "प्रातः 4:00 – 6:00, सर्वाधिक प्रभावी काल" }, prime: true },
  { label: { en: "Friday", hi: "शुक्रवार" }, detail: { en: "The secondary day, also considered auspicious", hi: "द्वितीय दिन, यह भी शुभ माना जाता है" } },
  { label: { en: "Shukla Ashtami", hi: "शुक्ल अष्टमी" }, detail: { en: "The eighth day of the bright fortnight, monthly", hi: "शुक्ल पक्ष की अष्टमी, प्रति मास" } },
  { label: { en: "Baglamukhi Jayanti", hi: "बगलामुखी जयंती" }, detail: { en: "Vaishakh Shukla Ashtami — the year's largest day", hi: "वैशाख शुक्ल अष्टमी — वर्ष का सबसे बड़ा दिन" }, prime: true },
  { label: { en: "Navratri", hi: "नवरात्रि" }, detail: { en: "Both Chaitra and Shardiya — anushthans fill up early", hi: "चैत्र और शारदीय दोनों — अनुष्ठान शीघ्र भर जाते हैं" } },
];

export const SAMAGRI: { name: L; note: L; key?: boolean }[] = [
  { name: { en: "Haldi ki lakdi", hi: "हल्दी की लकड़ी" }, note: { en: "Primary fuel — never substituted", hi: "मुख्य ईंधन — कभी प्रतिस्थापित नहीं" }, key: true },
  { name: { en: "Peeli sarson", hi: "पीली सरसों" }, note: { en: "In every single ahuti", hi: "प्रत्येक आहुति में" }, key: true },
  { name: { en: "Desi cow ghee", hi: "देसी गोघृत" }, note: { en: "500 ml minimum", hi: "न्यूनतम 500 मि.ली." } },
  { name: { en: "Whole turmeric roots", hi: "समूची हल्दी की गाँठें" }, note: { en: "Offered as eleven", hi: "ग्यारह की संख्या में अर्पित" } },
  { name: { en: "Yellow marigold & champa", hi: "पीला गेंदा एवं चंपा" }, note: { en: "Yellow only, never red", hi: "केवल पीत वर्ण, लाल कभी नहीं" } },
  { name: { en: "Besan laddoo", hi: "बेसन के लड्डू" }, note: { en: "Naivedya, and the prasad after", hi: "नैवेद्य, और तत्पश्चात प्रसाद" } },
  { name: { en: "Peele til & jau", hi: "पीले तिल एवं जौ" }, note: { en: "The Vedic grain offerings", hi: "वैदिक धान्य अर्पण" } },
  { name: { en: "Dry coconut & makhana", hi: "सूखा नारियल एवं मखाना" }, note: { en: "Kept back for the purnahuti", hi: "पूर्णाहुति हेतु सुरक्षित" } },
  { name: { en: "21 special jadi-buti", hi: "21 विशेष जड़ी-बूटियाँ" }, note: { en: "Only in the Vishesh tier and above", hi: "केवल विशेष स्तर और उससे ऊपर" } },
];

/** The place the fire is actually lit — context a devotee books on. */
export const TEMPLE_FACTS: { value: L; label: L }[] = [
  { value: { en: "Dwapar Yuga", hi: "द्वापर युग" }, label: { en: "Installed by Yudhishthira on Krishna's counsel", hi: "श्रीकृष्ण के परामर्श से युधिष्ठिर द्वारा स्थापित" } },
  { value: { en: "1 of 3", hi: "3 में से 1" }, label: { en: "Baglamukhi Siddha Peeths — with Datia and Kangra", hi: "बगलामुखी सिद्ध पीठ — दतिया और काँगड़ा के साथ" } },
  { value: { en: "5 AM – 9 PM", hi: "प्रातः 5 – रात्रि 9" }, label: { en: "Darshan, all seven days", hi: "दर्शन, सातों दिन" } },
  { value: { en: "Lakhundar", hi: "लखुन्दर" }, label: { en: "The river the temple stands on, Agar Malwa, MP", hi: "जिस नदी के तट पर मंदिर है, आगर मालवा, म.प्र." } },
];

/* ═══════════════════════════════════════════════════════════════
   8. Trust, and the questions everyone actually asks
   ═══════════════════════════════════════════════════════════════ */

export const TRUST_CHECKS: { title: L; text: L }[] = [
  {
    title: { en: "Hear your own name in the sankalp", hi: "संकल्प में अपना नाम स्वयं सुनें" },
    text: {
      en: "Ask to be on the call at the sankalp, not just sent a video afterwards. Your name, your father's name, your gotra and your city should be audible and correct. A ritual you cannot hear yourself named in is a ritual you cannot verify.",
      hi: "संकल्प के समय कॉल पर रहने का आग्रह करें, केवल बाद में वीडियो लेने से काम न चलाएँ। आपका नाम, पिता का नाम, गोत्र और नगर स्पष्ट और शुद्ध सुनाई देने चाहिए। जिस अनुष्ठान में आप स्वयं को नामित होते नहीं सुन सकते, उसे आप प्रमाणित नहीं कर सकते।",
    },
  },
  {
    title: { en: "Ask which acharya, by name", hi: "किस आचार्य द्वारा — नाम पूछें" },
    text: {
      en: "A Baglamukhi anushthan is advanced tantric practice; the mantra count, nyasa and paddhati should be settled by a qualified upasaka. On PanditSuggest you can open that Pandit Ji's profile, see their credentials, and speak to them directly before anything is paid.",
      hi: "बगलामुखी अनुष्ठान उन्नत तांत्रिक साधना है; मंत्र संख्या, न्यास और पद्धति किसी योग्य उपासक द्वारा ही निर्धारित होनी चाहिए। PanditSuggest पर आप उन पंडित जी की प्रोफ़ाइल खोल सकते हैं, उनके प्रमाण देख सकते हैं, और कोई भी भुगतान करने से पहले सीधे बात कर सकते हैं।",
    },
  },
  {
    title: { en: "Be careful with advance payments", hi: "अग्रिम भुगतान में सावधानी" },
    text: {
      en: "Nalkheda has a known problem with agents who are not connected to any temple or acharya. Do not send a full advance to a number that contacted you first, and treat anyone guaranteeing a court verdict, a job or a marriage as a warning sign, not a recommendation.",
      hi: "नलखेड़ा में ऐसे एजेंटों की ज्ञात समस्या है जिनका किसी मंदिर या आचार्य से संबंध नहीं होता। जो नंबर स्वयं आपसे पहले संपर्क करे, उसे पूरी अग्रिम राशि न भेजें, और जो कोई न्यायालय के निर्णय, नौकरी या विवाह की गारंटी दे — उसे संकेत मानें, सिफ़ारिश नहीं।",
    },
  },
];

export const FAQS: { q: L; a: L }[] = [
  {
    q: { en: "Is a havan done online really valid?", hi: "क्या ऑनलाइन किया गया हवन वास्तव में मान्य होता है?" },
    a: {
      en: "In tradition, what binds a ritual to a person is the sankalp — the name, gotra and purpose spoken over the fire — not the person's physical position. A puja performed by a qualified pandit, at the right time, with the sankalp taken correctly, is held to reach the yajman in their absence too. That is the same principle by which a family member has always been able to have a puja done for someone away from home.",
      hi: "परंपरा में अनुष्ठान को व्यक्ति से बाँधने वाला तत्व संकल्प है — अग्नि के समक्ष बोला गया नाम, गोत्र और उद्देश्य — न कि व्यक्ति की भौतिक उपस्थिति। योग्य पंडित द्वारा, उचित समय पर, विधिवत संकल्प के साथ की गई पूजा यजमान की अनुपस्थिति में भी उस तक पहुँचती मानी जाती है। यही वह सिद्धांत है जिससे परिवारजन सदा से घर से दूर किसी सदस्य के लिए पूजा करवाते आए हैं।",
    },
  },
  {
    q: { en: "Do I have to sit through the entire havan?", hi: "क्या मुझे पूरे हवन में बैठना आवश्यक है?" },
    a: {
      en: "No, and you should be suspicious of anyone who insists. The japa alone can run for hours, and a maha anushthan runs for days. Most devotees join for the sankalp, leave, and rejoin for the ahuti, purnahuti and aarti. The full recording covers everything you missed.",
      hi: "नहीं, और जो इस पर बल दे उस पर संदेह करना चाहिए। अकेला जप ही घंटों चल सकता है, और महा अनुष्ठान कई दिन। अधिकांश भक्त संकल्प के लिए जुड़ते हैं, फिर आहुति, पूर्णाहुति और आरती पर पुनः जुड़ते हैं। शेष सब पूरी रिकॉर्डिंग में रहता है।",
    },
  },
  {
    q: { en: "I don't know my gotra. Can I still do this?", hi: "मुझे अपना गोत्र नहीं पता। क्या फिर भी हो सकता है?" },
    a: {
      en: "Yes. Share your full name, your father's and grandfather's names, your birth place and your family's native village — the acharya can usually resolve it. Where it genuinely cannot be traced, Kashyap gotra is the traditional fallback, but let the pandit make that call rather than assuming it yourself.",
      hi: "हाँ। अपना पूरा नाम, पिता और दादा का नाम, जन्म स्थान और परिवार का मूल गाँव बताएँ — आचार्य प्रायः निर्धारित कर लेते हैं। जहाँ वास्तव में ज्ञात न हो सके, वहाँ कश्यप गोत्र परंपरागत विकल्प है, किंतु यह निर्णय स्वयं मान लेने के बजाय पंडित जी पर छोड़ें।",
    },
  },
  {
    q: { en: "Can I book from outside India?", hi: "क्या मैं भारत के बाहर से बुक कर सकता/सकती हूँ?" },
    a: {
      en: "Yes — remote sankalp is the reason online seva exists at all, and devotees join from the Gulf, the US, the UK, Australia and New Zealand. Ask for your sankalp to be scheduled at an hour you can actually be awake and seated for, and confirm that prasad courier reaches your country before you book.",
      hi: "हाँ — दूरस्थ संकल्प ही ऑनलाइन सेवा का मूल कारण है, और खाड़ी देशों, अमेरिका, ब्रिटेन, ऑस्ट्रेलिया व न्यूज़ीलैंड से भक्त जुड़ते हैं। अपना संकल्प ऐसे समय निश्चित करवाएँ जब आप वास्तव में जागकर बैठ सकें, और बुकिंग से पूर्व यह पुष्टि कर लें कि प्रसाद कूरियर आपके देश तक पहुँचता है।",
    },
  },
  {
    q: { en: "How long does the whole thing take?", hi: "पूरी प्रक्रिया में कितना समय लगता है?" },
    a: {
      en: "A Samanya or Vishesh havan is a single day, typically from Brahma Muhurat to midday. An anushthan is graded by japa count — 36,000 upward — and a 1,25,000 maha anushthan usually runs nine to eleven days, with the havan and purnahuti on the final day. Your live call is on that final day.",
      hi: "सामान्य या विशेष हवन एक ही दिन का होता है, प्रायः ब्रह्म मुहूर्त से मध्याह्न तक। अनुष्ठान जप संख्या से निर्धारित होता है — 36,000 से ऊपर — और 1,25,000 का महा अनुष्ठान प्रायः नौ से ग्यारह दिन चलता है, जिसमें हवन और पूर्णाहुति अंतिम दिन होती है। आपकी लाइव कॉल उसी अंतिम दिन होती है।",
    },
  },
  {
    q: { en: "Should I light a fire at home during the call?", hi: "क्या कॉल के दौरान मुझे घर पर अग्नि जलानी चाहिए?" },
    a: {
      en: "Not unless your acharya specifically asks you to. A diya is enough. A havan kund at home needs its own vidhi, its own samagri and someone who knows how to close it — running one unsupervised alongside a live call is how it goes wrong.",
      hi: "जब तक आचार्य विशेष रूप से न कहें, नहीं। एक दीपक पर्याप्त है। घर पर हवन कुंड की अपनी विधि, अपनी सामग्री और उसे विधिवत समाप्त करना जानने वाला व्यक्ति चाहिए — बिना मार्गदर्शन के लाइव कॉल के साथ ऐसा करना ही गड़बड़ी का कारण बनता है।",
    },
  },
  {
    q: { en: "Can women participate during menstruation?", hi: "क्या रजस्वला अवस्था में स्त्रियाँ सहभागी हो सकती हैं?" },
    a: {
      en: "Traditional paddhati asks that the yajman not actively participate in the ritual then, which is one practical reason the muhurat is fixed in advance. The sankalp can be taken in the name of a spouse or family member, or the date can simply be moved — ask the acharya, since practice varies between traditions.",
      hi: "परंपरागत पद्धति में उस समय यजमान की सक्रिय सहभागिता नहीं कही गई है, और मुहूर्त पहले से निश्चित करने का एक व्यावहारिक कारण यही है। संकल्प पति/पत्नी या परिवार के किसी सदस्य के नाम से लिया जा सकता है, अथवा तिथि बदली जा सकती है — आचार्य से पूछें, क्योंकि परंपराओं में विधान भिन्न होता है।",
    },
  },
  {
    q: { en: "Will this guarantee I win my court case?", hi: "क्या इससे मेरा न्यायालय का मुकदमा जीतने की गारंटी है?" },
    a: {
      en: "No, and nobody honest will tell you otherwise. Maa Baglamukhi is worshipped traditionally for stambhan — steadiness against opposition, clarity in speech, protection — and devotees have brought legal, professional and family matters to this fire for centuries. It is a devotional intention, not a legal, medical or financial outcome, and PanditSuggest lists it that way everywhere.",
      hi: "नहीं, और कोई ईमानदार व्यक्ति आपसे कुछ और नहीं कहेगा। माँ बगलामुखी की उपासना परंपरागत रूप से स्तंभन हेतु होती है — विरोध के समक्ष स्थिरता, वाणी में स्पष्टता, रक्षा — और भक्त सदियों से विधिक, व्यावसायिक तथा पारिवारिक विषय इस अग्नि तक लाते रहे हैं। यह श्रद्धा का संकल्प है, कोई विधिक, चिकित्सकीय या आर्थिक परिणाम नहीं — और PanditSuggest इसे सर्वत्र इसी रूप में प्रस्तुत करता है।",
    },
  },
  {
    q: { en: "What if my internet drops during the sankalp?", hi: "यदि संकल्प के समय मेरा इंटरनेट चला जाए तो?" },
    a: {
      en: "The ritual does not stop and does not need to be repeated — the sankalp was spoken over the fire, and the fire does not depend on your connection. Ask for the recorded clip of that moment; a pandit who was actually performing it will have no trouble sending it.",
      hi: "अनुष्ठान रुकता नहीं और उसे दोहराने की आवश्यकता नहीं — संकल्प अग्नि के समक्ष बोला जा चुका, और अग्नि आपके नेटवर्क पर निर्भर नहीं। उस क्षण की रिकॉर्ड की गई क्लिप माँगें; जो पंडित सचमुच अनुष्ठान कर रहे थे, उन्हें भेजने में कोई कठिनाई नहीं होगी।",
    },
  },
  {
    q: { en: "How do I choose between the havan tiers?", hi: "हवन के स्तरों में से किसे चुनूँ?" },
    a: {
      en: "By the weight of the sankalp, not by the price. Standard samagri suits general peace, protection and family well-being; the twenty-one jadi-buti tier is taken for a specific pressing matter; a multi-day anushthan is taken when someone is prepared to give it days rather than a morning. Describe the situation to a Pandit Ji and let them place it.",
      hi: "संकल्प के भार से, मूल्य से नहीं। सामान्य सामग्री सामान्य शांति, रक्षा और पारिवारिक कल्याण हेतु उपयुक्त है; इक्कीस जड़ी-बूटी का स्तर किसी विशिष्ट तात्कालिक विषय हेतु लिया जाता है; बहुदिवसीय अनुष्ठान तब, जब कोई एक प्रातः नहीं, कई दिन देने को तत्पर हो। अपनी स्थिति पंडित जी को बताएँ और निर्धारण उन पर छोड़ें।",
    },
  },
];
