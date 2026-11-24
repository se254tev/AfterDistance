const LANGUAGES = [
  { id: 'english', label: 'English' },
  { id: 'swahili', label: 'Kiswahili' },
  { id: 'sheng', label: 'Sheng' },
  { id: 'mixed', label: 'Mixed Kenyan Language' }
];

const MODES = [
  { id: 'classic', label: 'The Other Side of Us' },
  { id: 'comedy', label: 'Comedy Mode' },
  { id: 'romance', label: 'Romance Mode' },
  { id: 'savage', label: 'Savage Mode (playful)' },
  { id: 'mind-reader', label: 'Mind Reader Mode' }
];

const EXPERIENCES = [
  { id: 'classic', label: 'The Other Side of Us' },
  { id: 'kenyan', label: 'Kenyan Comedy Experience' }
];

const PACKS = [
  { id: 'mixed', label: 'Random Kenyan Mix' },
  { id: 'matatu-madness', label: 'Matatu Madness' },
  { id: 'choma-na-story', label: 'Choma na Story' },
  { id: 'campus-chronicles', label: 'Campus Chronicles' },
  { id: 'nairobi-vibes', label: 'Nairobi Vibes' },
  { id: 'mapenzi-na-drama', label: 'Mapenzi na Drama' },
  { id: 'sheng-central', label: 'Sheng Central' }
];

const CATEGORIES = [
  { id: 'classic', label: 'The Other Side of Us' },
  { id: 'mixed', label: 'Random Kenyan Mix' },
  { id: 'funny-predictions', label: 'UMENISHIKA! · Funny predictions' },
  { id: 'complete-story', label: 'NIPEE STORY! · Complete the story' },
  { id: 'truth-bluff', label: 'UKWELI AMA UONGO? · Truth or bluff' },
  { id: 'who-more-likely', label: 'NANI ANAWEZA? · Who is more likely?' },
  { id: 'sheng-battle', label: 'SHENG BATTLE · Decode the Sheng' },
  { id: 'romantic-comedy', label: 'MAPENZI NA DRAMA · Romantic comedy' },
  { id: 'mini-challenge', label: 'FANYA AMA UFE NA KICHEKO · Mini challenges' }
];

const CHOICE_SETS = {
  reactions: {
    english: ['Make a plan', 'Bluff confidently', 'Ask for backup', 'Turn it into a story'],
    swahili: ['Tupange haraka', 'Jifanye uko sawa', 'Omba backup', 'Geuza ikuwe story'],
    sheng: ['Tupange rada', 'Jifanya uko fiti', 'Call backup', 'Geuza ikuwe story'],
    mixed: ['Tupange haraka', 'Jifanya uko fiti', 'Call backup', 'Geuza ikuwe story']
  },
  players: {
    english: ['PLAYER_1', 'PLAYER_2'],
    swahili: ['PLAYER_1', 'PLAYER_2'],
    sheng: ['PLAYER_1', 'PLAYER_2'],
    mixed: ['PLAYER_1', 'PLAYER_2']
  },
  truth: {
    english: ['Yes, hiyo ni ukweli', 'No, hiyo ni uongo'],
    swahili: ['Ndiyo, ni kweli', 'Hapana, ni uongo'],
    sheng: ['Eeh, ni ukweli', 'Zii, ni uwongo'],
    mixed: ['Eeh, ni kweli', 'Zii, hiyo ni uongo']
  },
  storyStyles: {
    english: ['A plot twist', 'A sweet ending', 'Total chaos', 'A matatu saves the day'],
    swahili: ['Mambo yanageuka ghafla', 'Mwisho mtamu', 'Fujo tupu', 'Matatu inaokoa siku'],
    sheng: ['Plot twist ya nguvu', 'Ending tamu', 'Mambo ni chaos', 'Mat itaokoa siku'],
    mixed: ['Plot twist ya nguvu', 'Ending tamu', 'Chaos tupu', 'Mat inaokoa siku']
  },
  challenge: {
    english: ['I’m in!', 'I’ll pass this one'],
    swahili: ['Niko tayari!', 'Napita hii'],
    sheng: ['Niko rada!', 'Naskip hii'],
    mixed: ['Niko rada!', 'Napita hii']
  }
};

const t = (english, swahili, sheng, mixed) => ({ english, swahili, sheng, mixed });
const questionBank = [];

function addQuestion({
  id, category, pack, prompt, answerType = 'choice', choiceSet = 'reactions',
  choices, correctChoiceIndex, explanation, roundId, tags = [], choiceTags = {},
  modes = ['comedy', 'romance', 'savage', 'mind-reader'], difficulty = 'easy'
}) {
  questionBank.push({
    id, category, pack, prompt, answerType, choiceSet, choices, correctChoiceIndex,
    explanation, roundId, tags, choiceTags, modes, difficulty
  });
}

const classicRows = [
  ['train', 'matatu-madness', t(
    'Nairobi traffic has frozen the city. We have one hour and one umbrella. What is our move?',
    'Foleni ya Nairobi imesimama. Tuna saa moja na mwavuli mmoja. Tunafanya nini?',
    'Traffic ya Nai imejam kabisa. Tuna saa moja na umbrella moja, tunapanga aje?',
    'Traffic ya Nairobi imejam. Tuna saa moja na mwavuli mmoja—plan ni gani?'
  )],
  ['train', 'nairobi-vibes', t(
    'The last matatu to our stop is leaving. What do you do first?',
    'Matatu ya mwisho inaondoka. Unafanya nini kwanza?',
    'Mat ya mwisho inaenda. Una-handle aje?',
    'Mat ya mwisho inasepa—unafanya nini kwanza?'
  )],
  ['train', 'choma-na-story', t(
    'Our night adventure has no map, but someone packed snacks. Who takes charge?',
    'Safari yetu ya usiku haina ramani, lakini kuna vitafunio. Nani anaongoza?',
    'Adventure ya usiku haina map, lakini kuna snacks. Nani anaongoza?',
    'Adventure haina map but kuna snacks—nani anachukua usukani?'
  )],
  ['train', 'campus-chronicles', t(
    'The campus shuttle is full, the lecture starts now, and we are still outside. What is plan B?',
    'Basi la campus limejaa, lecture inaanza sasa, na bado tuko nje. Plan B ni gani?',
    'Campus shuttle imejaa, lecture inaanza sai, na tuko nje. Plan B ni gani?',
    'Shuttle imejaa, lecture ni sasa na tuko nje—plan B?'
  )],
  ['garden', 'choma-na-story', t(
    'Unexpected guests arrive while the house looks like a laundry documentary. What do you hide first?',
    'Wageni wamefika bila taarifa na nyumba imejaa nguo. Unaficha nini kwanza?',
    'Wageni wamefika bila warning na nyumba ni laundry documentary. Unaficha nini kwanza?',
    'Wageni wamefika bila warning na nyumba ni laundry documentary—una-hide nini?'
  )],
  ['garden', 'nairobi-vibes', t(
    'I’m at the gate and you have not even put on shoes. What message do I get?',
    'Niko getini na bado hujavaa viatu. Unanitumia ujumbe gani?',
    'Niko gate na bado hujavaa viatu. Unanitext nini?',
    'Niko gate na hujavaa viatu—unanitext nini?'
  )],
  ['garden', 'matatu-madness', t(
    'A surprise visitor says they are “just five minutes away.” How do we rescue the living room?',
    'Mgeni wa ghafla anasema atafika baada ya dakika tano. Tunaokoa sebule aje?',
    'Mgeni anasema ako five minutes away. Tuna-rescue sitting room aje?',
    'Mgeni ako five minutes away—tuna-save sitting room aje?'
  )],
  ['garden', 'mapenzi-na-drama', t(
    'I arrive hungry, the fridge is giving empty vibes, and we have one pan. What happens?',
    'Nimefika na njaa, friji haina kitu, na tuna sufuria moja. Tunafanya nini?',
    'Nimefika na njaa, fridge iko empty na tuna sufuria moja. Plan ni gani?',
    'Nimefika na njaa, fridge ni empty na tuna pan moja—tunaokoa aje?'
  )],
  ['city', 'nairobi-vibes', t(
    'We are in Nairobi, the phone is at 2%, and the fare is missing. What is your first move?',
    'Tuko Nairobi, simu iko 2%, na fare haipo. Unaanza na nini?',
    'Tuko Nai, simu iko 2% na fare imeisha. Una-start na nini?',
    'Tuko Nai, simu 2%, fare imeisha—move ya kwanza ni gani?'
  )],
  ['city', 'matatu-madness', t(
    'The matatu passed our stage. Do we sprint, laugh, or negotiate with the conductor?',
    'Matatu imepita stage yetu. Tunakimbia, tunacheka, ama tunaongea na conductor?',
    'Mat imepita stage. Tunakimbia, tunacheka ama tunadeal na conductor?',
    'Mat imepita stage—tunakimbia ama tunadeal na conductor?'
  )],
  ['city', 'campus-chronicles', t(
    'The HELB alert arrives during a date. What is the most responsible celebration?',
    'Ujumbe wa HELB umefika tukiwa date. Tunasherehekea aje bila kutumia yote?',
    'HELB imeingia tukiwa date. Tunacelebrate aje bila kuimaliza?',
    'HELB imeingia tukiwa date—celebration bila kuichoma yote ni gani?'
  )],
  ['city', 'choma-na-story', t(
    'The bill arrives and the M-Pesa balance is playing hide-and-seek. What do we do?',
    'Bili imefika na salio la M-Pesa limejificha. Tunafanya nini?',
    'Bill imefika na M-Pesa balance imejificha. Tunadeal aje?',
    'Bill imefika na M-Pesa inajifanya haiko—plan?'
  )],
  ['letter', 'campus-chronicles', t(
    'You typed “niko njiani” but you are still at home. What is your honest follow-up?',
    'Umetuma “niko njiani” lakini bado uko nyumbani. Unasema ukweli gani sasa?',
    'Umesema “niko njiani” lakini uko home. Unafollow-up aje?',
    'Umesema “niko njiani” lakini uko home—unacorrect aje?'
  )],
  ['letter', 'sheng-central', t(
    'A message says “we need to talk.” What do you do before opening it?',
    'Ujumbe unasema “tunahitaji kuongea.” Unafanya nini kabla ya kuufungua?',
    'Text inasema “tunahitaji kuongea.” Unafanya nini kabla uifungue?',
    'Text ya “tunahitaji kuongea” imeingia—unafanya nini first?'
  )],
  ['letter', 'mapenzi-na-drama', t(
    'You accidentally send a voice note of you singing to the family group. What is the recovery plan?',
    'Umetuma voice note ukiimba kwa group ya familia kimakosa. Unaokoa hali aje?',
    'Umetuma voice note ya kuimba kwa family group. Una-recover aje?',
    'Voice note ya kuimba imeenda family group—damage control?'
  )],
  ['letter', 'nairobi-vibes', t(
    'You forgot to reply for two days. Which apology sounds most like you?',
    'Umesahau kujibu kwa siku mbili. Unaomba msamaha aje?',
    'Uliacha text on read siku mbili. Unaapologize aje?',
    'Umeghost text siku mbili—unaomba msamaha aje?'
  )],
  ['horizon', 'mapenzi-na-drama', t(
    'I return today with no warning. What do you ask me before anything else?',
    'Nimerudi leo bila kukuambia. Utaniuliza nini kwanza?',
    'Nimerudi leo bila warning. Utaniuliza nini first?',
    'Nimerudi leo bila warning—swali ya kwanza ni gani?'
  )],
  ['horizon', 'choma-na-story', t(
    'The reunion meal is slightly burnt. Are we comforting the chef or ordering chips?',
    'Chakula cha reunion kimeungua kidogo. Tunamfariji mpishi ama tunaagiza chips?',
    'Chakula imeungua kiasi. Tunacomfort chef ama tunaorder chips?',
    'Chakula imeungua kiasi—comfort chef ama chips masala?'
  )],
  ['horizon', 'matatu-madness', t(
    'We finally meet, but the matatu conductor thinks we are blocking the stage. What is the reunion soundtrack?',
    'Hatimaye tumekutana, lakini conductor anasema tumezuia stage. Wimbo wa reunion ni gani?',
    'Tumekutana lakini conductor anasema tumeblock stage. Reunion soundtrack ni gani?',
    'Tumekutana lakini conductor anataka space—soundtrack ya reunion?'
  )],
  ['horizon', 'sheng-central', t(
    'Give a 10-second apology for eating the last piece of chicken.',
    'Omba msamaha kwa sekunde kumi kwa kula kipande cha mwisho cha kuku.',
    'Apologize kwa sekunde kumi juu umechukua last piece ya chicken.',
    'Apology ya sekunde kumi juu umechukua last piece ya chicken—go!'
  )]
];

for (const [roundId, pack, prompt] of classicRows) {
  addQuestion({
    id: `classic-${roundId}-${questionBank.length}`,
    category: 'classic', roundId, pack, prompt,
    answerType: 'choice', choiceSet: 'reactions', modes: ['classic', 'comedy', 'romance', 'savage', 'mind-reader'],
    tags: roundId === 'city' || roundId === 'train' ? ['nairobi'] : []
  });
}

const categoryRows = [
  ['funny-predictions', 'matatu-madness', 'player', 'Who is more likely to miss the stage, then confidently blame the conductor?', 'Nani anaweza kushuka stage mbaya halafu alaumu conductor?', 'Nani anashuka stage wrong alafu ana-blame conductor?', 'Nani anaweza miss stage halafu conductor ndio anapata lawama?'],
  ['funny-predictions', 'campus-chronicles', 'player', 'Who is more likely to spend HELB on snacks before checking rent?', 'Nani anaweza kutumia HELB kwa snacks kabla ya kulipa rent?', 'Nani anaweza choma HELB kwa snacks kabla acheck rent?', 'Nani anaweza maliza HELB kwa snacks kabla ya rent?'],
  ['funny-predictions', 'nairobi-vibes', 'player', 'Who would get lost with Google Maps open and still give directions?', 'Nani anaweza kupotea na Google Maps wazi halafu aanze kutoa directions?', 'Nani anaweza lost na Maps iko open alafu aanze kutoa directions?', 'Nani anaweza potea na Maps open halafu bado atoe directions?'],
  ['funny-predictions', 'choma-na-story', 'player', 'Who says “I’m full” then finishes everyone’s chips?', 'Nani husema “nimeshiba” halafu amalize chips za wote?', 'Nani husema “nimeshiba” alafu amalize chips za wasee?', 'Nani husema ameshiba halafu amalize chips zote?'],
  ['funny-predictions', 'mapenzi-na-drama', 'player', 'Who would start a serious discussion during the movie’s best scene?', 'Nani anaweza kuanzisha mazungumzo mazito wakati movie iko tamu?', 'Nani anaweza anzisha serious talk wakati movie iko fire?', 'Nani anaweza leta serious talk kwa best scene ya movie?'],
  ['funny-predictions', 'sheng-central', 'player', 'Who forgets why they entered a room, then pretends it was a phone call?', 'Nani husahau aliingia chumbani kufanya nini halafu ajifanye alipigiwa simu?', 'Nani husahau aliingia room nini alafu ajifanye alipigiwa?', 'Nani huingia room, asahau mission, halafu ajifanye alikuwa anaongea kwa simu?'],
  ['funny-predictions', 'nairobi-vibes', 'player', 'Who would buy a “limited offer” gadget and read the reviews later?', 'Nani atanunua kifaa cha “offer ya leo tu” halafu asome reviews baadaye?', 'Nani atanunua gadget ya offer alafu asome reviews later?', 'Nani atanunua gadget ya offer alafu reviews asome baadaye?'],
  ['funny-predictions', 'choma-na-story', 'player', 'Who laughs first when everyone is trying to take a serious family photo?', 'Nani hucheka kwanza wakati wote wanajaribu kupiga picha serious ya familia?', 'Nani hucheka first wakati family inajaribu serious photo?', 'Nani huharibu family photo serious kwa kucheka first?'],
  ['funny-predictions', 'choma-na-story', 'player', 'Who would fall asleep halfway through a movie and deny it?', 'Nani anaweza kulala katikati ya filamu halafu akatae?', 'Nani anaweza lala movie ikiendelea alafu akatae?', 'Nani anaweza lala halfway kwa movie halafu aseme alikuwa anafikiria tu?', ['sleep']],
  ['funny-predictions', 'nairobi-vibes', 'player', 'Who is more likely to finish their salary before checking the rent date?', 'Nani anaweza kumaliza mshahara kabla ya kuangalia tarehe ya rent?', 'Nani anaweza choma salary kabla acheck rent?', 'Nani anaweza maliza salary kabla ya kuangalia rent?', ['budget']],

  ['complete-story', 'nairobi-vibes', 'text', 'The waiter brings a KSh 15,000 bill. I look at you and say…', 'Mhudumu analeta bili ya KSh 15,000. Nakutazama na kusema…', 'Waiter ameleta bill ya KSh 15,000. Nakuangalia nakuambia…', 'Bill ya KSh 15,000 imefika. Nakutazama na kusema…'],
  ['complete-story', 'matatu-madness', 'text', 'The matatu stops in the middle of traffic and the conductor announces…', 'Matatu inasimama katikati ya foleni na conductor anatangaza…', 'Mat imestop kwa traffic na conductor anasema…', 'Mat imestop kwa traffic, conductor anatangaza…'],
  ['complete-story', 'campus-chronicles', 'text', 'The lecturer says “pop quiz” and I suddenly remember…', 'Mhadhiri anasema “jaribio la ghafla” na nakumbuka…', 'Lecturer amesema “pop quiz” na nakumbuka…', 'Lecturer amesema “pop quiz” na memory inarudi…'],
  ['complete-story', 'choma-na-story', 'text', 'I opened the fridge at midnight and the only thing inside was…', 'Nilifungua friji usiku wa manane na kitu pekee ndani kilikuwa…', 'Nimefungua fridge midnight na kitu pekee iko ni…', 'Midnight nimefungua fridge, kitu pekee iko ndani ni…'],
  ['complete-story', 'mapenzi-na-drama', 'text', 'I said “I’m not hungry,” then your food arrived. Suddenly…', 'Nilisema “sina njaa,” halafu chakula chako kikafika. Ghafla…', 'Nimesema “sina njaa,” food yako imefika. Ghafla…', 'Nimesema sina njaa, food yako imefika—ghafla…'],
  ['complete-story', 'sheng-central', 'text', 'The family group went quiet after my message, then Auntie replied…', 'Group ya familia ilinyamaza baada ya ujumbe wangu, kisha shangazi akajibu…', 'Family group imeingia silent baada ya text yangu, alafu auntie akareply…', 'Family group imekaa kimya baada ya text yangu, Auntie aka-reply…'],
  ['complete-story', 'nairobi-vibes', 'text', 'The M-Pesa message says “balance is KSh 0.00” and I confidently say…', 'Ujumbe wa M-Pesa unasema salio ni KSh 0.00, lakini nasema…', 'M-Pesa message inasema balance ni zero, lakini nasema…', 'M-Pesa balance ni KSh 0.00, lakini nasema confidently…'],
  ['complete-story', 'choma-na-story', 'text', 'We arrived at the choma spot and the last piece of nyama was…', 'Tumefika kwa choma na kipande cha mwisho cha nyama kilikuwa…', 'Tumefika choma spot na last piece ya nyama ilikuwa…', 'Tuko choma spot, last piece ya nyama ni…'],

  ['truth-bluff', 'nairobi-vibes', 'truth', 'Have you ever said “niko njiani” while you were still choosing what to wear?', 'Umewahi kusema “niko njiani” ukiwa bado unachagua nguo?', 'Umewahi sema “niko njiani” ukiwa bado unachagua outfit?', 'Umewahi sema niko njiani ukiwa bado unatafuta outfit?', ['excuses']],
  ['truth-bluff', 'mapenzi-na-drama', 'truth', 'Have you ever pretended to be asleep to avoid one more conversation?', 'Umewahi kujifanya umelala ili uepuke mazungumzo mengine?', 'Umewahi jifanya umelala uavoid story ingine?', 'Umewahi act umelala ndio uavoid story ingine?'],
  ['truth-bluff', 'choma-na-story', 'truth', 'Have you ever laughed at a joke before understanding it?', 'Umewahi kucheka utani kabla ya kuuelewa?', 'Umewahi laugh kwa joke kabla uelewe?', 'Umewahi cheka joke kabla uelewe punchline?'],
  ['truth-bluff', 'campus-chronicles', 'truth', 'Have you ever attended a lecture mainly because attendance was being checked?', 'Umewahi kuhudhuria lecture hasa kwa sababu attendance ilikuwa inakaguliwa?', 'Umewahi enda lecture juu attendance ilikuwa inacheckiwa?', 'Umewahi enda lecture juu tu attendance inaangaliwa?'],
  ['truth-bluff', 'matatu-madness', 'truth', 'Have you ever nodded like you knew the stage, then asked someone quietly?', 'Umewahi kutikisa kichwa kana kwamba unajua stage, halafu uulize mtu kimya kimya?', 'Umewahi nod kama unajua stage alafu uulize mtu chini chini?', 'Umewahi nod kama unajua stage lakini baadaye uulize mtu?'],
  ['truth-bluff', 'sheng-central', 'truth', 'Have you ever agreed with a Sheng phrase, then searched its meaning later?', 'Umewahi kukubaliana na msemo wa Sheng halafu utafute maana yake baadaye?', 'Umewahi sema uko rada na Sheng alafu ugoogle later?', 'Umewahi nod kwa Sheng phrase halafu utafute meaning baadaye?'],
  ['truth-bluff', 'nairobi-vibes', 'truth', 'Have you ever opened M-Pesa to check your balance and closed it for peace?', 'Umewahi kufungua M-Pesa kuangalia salio halafu uifunge ili upate amani?', 'Umewahi check M-Pesa balance alafu uclose app for peace?', 'Umewahi ona balance M-Pesa halafu uclose app upate amani?'],
  ['truth-bluff', 'choma-na-story', 'truth', 'Have you ever hidden the best snack so nobody else would find it?', 'Umewahi kuficha kitafunio kitamu ili wengine wasikione?', 'Umewahi ficha snack poa wasee wasipate?', 'Umewahi hide snack poa usishare na mtu?'],

  ['who-more-likely', 'nairobi-vibes', 'player', 'Who would turn a quick errand into a full Nairobi expedition?', 'Nani anaweza kugeuza shughuli ya haraka iwe safari nzima ya Nairobi?', 'Nani anaweza geuza errand fupi ikuwe Nairobi expedition?', 'Nani anaweza geuza errand ya dakika tano ikuwe expedition ya Nairobi?'],
  ['who-more-likely', 'choma-na-story', 'player', 'Who would invite “one friend” and arrive with the whole squad?', 'Nani angealika rafiki mmoja halafu afike na squad nzima?', 'Nani angeita beshte mmoja alafu afike na squad mzima?', 'Nani angesema anakuja na beshte mmoja halafu afike na squad?'],
  ['who-more-likely', 'mapenzi-na-drama', 'player', 'Who would notice a “seen” with no reply in under ten seconds?', 'Nani ataona ujumbe umesomwa bila jibu ndani ya sekunde kumi?', 'Nani ataona seen bila reply in ten seconds?', 'Nani ataona seen bila reply before dakika moja?'],
  ['who-more-likely', 'campus-chronicles', 'player', 'Who would start revision the night before exams and call it a strategy?', 'Nani angeanza kusoma usiku kabla ya mtihani na kuita hiyo strategy?', 'Nani anaanza kusoma exam eve alafu anaita strategy?', 'Nani anaanza revision usiku wa mwisho halafu aseme ni strategy?'],
  ['who-more-likely', 'matatu-madness', 'player', 'Who would negotiate with the conductor like they are in parliament?', 'Nani anaweza kujadiliana na conductor kana kwamba yuko bungeni?', 'Nani anaweza negotiate na conductor kama yuko parliament?', 'Nani anaweza jadiliana na conductor kama debate ya parliament?'],
  ['who-more-likely', 'sheng-central', 'player', 'Who would confidently use a new Sheng phrase and invent the meaning?', 'Nani atatumia Sheng mpya kwa confidence na kubuni maana yake?', 'Nani atatumia Sheng phrase mpya confidently na abuni meaning?', 'Nani ata-drop Sheng mpya confidently halafu abuni meaning?'],
  ['who-more-likely', 'nairobi-vibes', 'player', 'Who would buy something unnecessary because “it was on offer”?', 'Nani atanunua kitu kisichohitajika kwa sababu “kilikuwa offer”?', 'Nani atanunua kitu juu “iko offer” hata haihitajiki?', 'Nani atanunua kitu haimuhitaji juu tu iko offer?'],
  ['who-more-likely', 'choma-na-story', 'player', 'Who would volunteer to cook, then ask for delivery menus?', 'Nani angejitolea kupika halafu aanze kutafuta menu za delivery?', 'Nani anajitolea kupika alafu anauliza delivery menu?', 'Nani atasema atapika halafu aanze ku-google delivery?'],

  ['sheng-battle', 'sheng-central', 'quiz', '“Umenishow dust” usually means…', '“Umenishow dust” kwa kawaida humaanisha…', '“Umenishow dust” inamaanisha…', '“Umenishow dust” most times inamaanisha…'],
  ['sheng-battle', 'sheng-central', 'quiz', '“Niko rada” usually tells you…', '“Niko rada” kwa kawaida inakuambia…', '“Niko rada” inamaanisha…', 'Ukisikia “niko rada,” mtu anasema…'],
  ['sheng-battle', 'sheng-central', 'quiz', 'In a casual chat, “hii ni noma” is closest to…', 'Kwa mazungumzo ya kawaida, “hii ni noma” iko karibu na…', 'Kwa chat, “hii ni noma” ni kama…', 'Kwa story ya mtaa, “hii ni noma” ni…'],
  ['sheng-battle', 'sheng-central', 'quiz', 'Someone asks “Aje sasa maze?” They are most likely…', 'Mtu akiuliza “Aje sasa maze?” kuna uwezekano ana…', 'Mtu akiuliza “Aje sasa maze?” anataka…', 'Ukiulizwa “Aje sasa maze?” mtu anataka…'],
  ['sheng-battle', 'sheng-central', 'quiz', '“Kuomoka” in a money conversation often means…', '“Kuomoka” kwenye mazungumzo ya pesa mara nyingi humaanisha…', 'Kwa story ya pesa, “kuomoka” ni…', 'Kwa story ya pesa, “kuomoka” most times ni…'],
  ['sheng-battle', 'sheng-central', 'quiz', '“Wasee wako rada” suggests the people are…', '“Wasee wako rada” inaashiria watu…', '“Wasee wako rada” inamaanisha wasee…', 'Ukisikia “wasee wako rada,” wasee…'],
  ['sheng-battle', 'sheng-central', 'quiz', '“Nimechill” most naturally means…', '“Nimechill” kwa kawaida humaanisha…', '“Nimechill” ni…', '“Nimechill” kwa mtaa inaweza maanisha…'],
  ['sheng-battle', 'sheng-central', 'quiz', '“Kudedi” in casual Sheng is often used for…', '“Kudedi” kwenye Sheng ya kawaida hutumika kwa…', '“Kudedi” kwa Sheng inatumika kwa…', 'Kwa Sheng, “kudedi” inaweza kuwa…'],

  ['romantic-comedy', 'mapenzi-na-drama', 'choice', 'Your partner burns the reunion meal. What is your first kind move?', 'Mpenzi wako ameunguza chakula cha reunion. Unasema nini kwanza kwa upole?', 'Mpenzi ameburn food ya reunion. Unacomfort aje first?', 'Chakula ya reunion imeungua—unacomfort aje bila kusema “nilijua”?'],
  ['romantic-comedy', 'choma-na-story', 'choice', 'They give you a KSh 50 gift with a very serious speech. Your reaction?', 'Amekupa zawadi ya KSh 50 kwa hotuba nzito. Unaitikiaje?', 'Amekupatia gift ya 50 bob na speech serious. Una-react aje?', 'Gift ya KSh 50 imekuja na speech—reaction yako?'],
  ['romantic-comedy', 'nairobi-vibes', 'choice', 'You are both late because of Nairobi traffic. Who gets the apology first?', 'Nyote mmechelewa kwa sababu ya foleni ya Nairobi. Nani anaomba msamaha kwanza?', 'Nairobi traffic imechelewesha wote. Nani anaapologize first?', 'Foleni ya Nai imechelewesha wote—nani anaomba msamaha first?'],
  ['romantic-comedy', 'mapenzi-na-drama', 'choice', 'After a tiny disagreement, choose the peace offering: apology, snacks, or a long hug?', 'Baada ya kutokubaliana kidogo, unachagua amani gani: msamaha, vitafunio, au kumbatio?', 'Baada ya disagreement ndogo, peace offering ni apology, snacks ama hug?', 'Mabishano madogo yameisha—apology, snacks ama hug ya amani?'],
  ['romantic-comedy', 'sheng-central', 'choice', 'Your partner says “I’m fine” with suspicious punctuation. What is your move?', 'Mpenzi wako anasema “niko sawa” lakini ujumbe unaonekana wa kutiliwa shaka. Unafanya nini?', 'Amesema “niko fine” na punctuation iko suspicious. Una-handle aje?', 'Amesema “niko sawa.” na full stop suspicious—unafanya nini?'],
  ['romantic-comedy', 'campus-chronicles', 'choice', 'You have one date budget left before HELB. What makes it memorable?', 'Kabla ya HELB, pesa ya date imebaki mara moja. Unaifanya ikumbukwe aje?', 'Budget ya date imebaki once kabla HELB. Unaifanya memorable aje?', 'Date budget moja imebaki kabla HELB—unaifanya ikuwe special aje?'],
  ['romantic-comedy', 'nairobi-vibes', 'choice', 'Your partner accidentally calls you by an ex’s name. What saves the moment?', 'Mpenzi wako amekuita jina la aliyekuwa naye kimakosa. Unaokoa hali aje?', 'Ameita jina ya ex by mistake. Una-save moment aje?', 'Ameita jina ya ex by mistake—unaokoa moment aje?'],
  ['romantic-comedy', 'choma-na-story', 'choice', 'You both reach for the last piece of chicken. What is the fairest solution?', 'Nyote mmefikia kipande cha mwisho cha kuku. Suluhisho la haki ni gani?', 'Wote mmegrab last piece ya chicken. Fair solution ni gani?', 'Last piece ya chicken ni moja, mikono miwili—fair plan?'],

  ['mini-challenge', 'matatu-madness', 'challenge', 'Optional: give a dramatic matatu-conductor announcement for your next snack.', 'Hiari: tangaza snack yako ijayo kama conductor wa matatu.', 'Optional: ita snack yako kama conductor wa matatu.', 'Hiari: announce snack yako kama conductor wa matatu wa stage.'],
  ['mini-challenge', 'nairobi-vibes', 'challenge', 'Optional: deliver a 10-second campaign speech asking for forgiveness.', 'Hiari: toa hotuba ya sekunde kumi ukiomba msamaha.', 'Optional: campaign speech ya sekunde kumi kuomba msamaha.', 'Hiari: speech ya sekunde kumi ya kuomba msamaha—fanya campaign!'],
  ['mini-challenge', 'choma-na-story', 'challenge', 'Optional: explain in one sentence why you deserve the last piece of chicken.', 'Hiari: eleza kwa sentensi moja kwa nini unastahili kipande cha mwisho cha kuku.', 'Optional: sentence moja ya why unadeserve last piece ya chicken.', 'Hiari: sentence moja—why wewe unastahili last piece ya chicken?'],
  ['mini-challenge', 'mapenzi-na-drama', 'challenge', 'Optional: describe your partner like a breaking-news reporter.', 'Hiari: muelezee mpenzi wako kama mwanahabari wa habari za dharura.', 'Optional: describe partner wako kama breaking-news reporter.', 'Hiari: mtaje partner kama breaking news reporter—no pressure!'],
  ['mini-challenge', 'campus-chronicles', 'challenge', 'Optional: pretend you have received a surprise HELB payment. Keep it family-friendly.', 'Hiari: jifanya umepokea HELB ya ghafla. Tumia maneno ya heshima.', 'Optional: act umereceive HELB surprise. Keep it clean.', 'Hiari: umeingia HELB surprise—celebrate kwa style, no recording needed.'],
  ['mini-challenge', 'sheng-central', 'challenge', 'Optional: say “nimekumbuka deni yako” like a dramatic movie trailer.', 'Hiari: sema “nimekumbuka deni yako” kama tangazo la filamu.', 'Optional: sema “nimekumbuka deni yako” kama movie trailer.', 'Hiari: “nimekumbuka deni yako”—movie trailer voice!'],
  ['mini-challenge', 'nairobi-vibes', 'challenge', 'Optional: describe your perfect low-budget Nairobi date in five words.', 'Hiari: eleza date nzuri ya gharama nafuu Nairobi kwa maneno matano.', 'Optional: describe date poa ya budget Nairobi in five words.', 'Hiari: Nairobi date ya budget, five words tu!'],
  ['mini-challenge', 'choma-na-story', 'challenge', 'Optional: give a 10-second toast to the person who always shares snacks.', 'Hiari: toa hongera za sekunde kumi kwa mtu anayeshiriki vitafunio.', 'Optional: toast ya seconds ten kwa mtu hushare snacks.', 'Hiari: toast ya sekunde kumi kwa mtu wa kushare snacks!']
];

const QUIZ_CHOICES = [
  [
    ['They ignored or outplayed you', 'You received dust from a fan', 'They showed you a new route', 'Someone cleaned your shoes'],
    ['Wamekupuuza au wamekuzidi ujanja', 'Umeonyeshwa vumbi la feni', 'Umeonyeshwa njia mpya', 'Mtu amesafisha viatu vyako'],
    ['Amekuignore ama amekuzidi ujanja', 'Fan amekuonyesha dust', 'Ameonyesha route mpya', 'Viatu zimeoshwa'],
    ['Ame-ignore ama amekuzidi ujanja', 'Umepewa dust na fan', 'Umeonyeshwa route mpya', 'Viatu zako zimeoshwa']
  ],
  [
    ['I am alert or aware', 'I am sleeping', 'I am angry', 'I am leaving town'],
    ['Niko macho au ninafahamu kinachoendelea', 'Nimelala', 'Nimekasirika', 'Ninaondoka mjini'],
    ['Niko rada na naelewa kinachoendelea', 'Nimelala', 'Nimejam', 'Nasepa town'],
    ['Niko alert na najua kinachoendelea', 'Nimelala fofofo', 'Nimejam', 'Nasepa town']
  ],
  [
    ['This is intense, impressive, or a lot', 'This is very quiet', 'This is free food', 'This is a bus stop'],
    ['Hili ni jambo kali, la kuvutia, au zito', 'Hili limetulia sana', 'Hiki ni chakula cha bure', 'Hii ni kituo cha basi'],
    ['Hii ni kali ama mambo ni mengi', 'Kuko kimya sana', 'Ni free food', 'Ni bus stage'],
    ['Hii ni kali au mambo ni mengi', 'Kuko kimya kabisa', 'Ni food ya bure', 'Ni bus stage']
  ],
  [
    ['Checking in or asking how things are', 'Asking for a loan', 'Ending the conversation', 'Looking for a stage'],
    ['Anauliza hali yako au anasalimia', 'Anaomba mkopo', 'Anamaliza mazungumzo', 'Anatafuta kituo'],
    ['Anacheki uko aje ama anasalimia', 'Anaomba loan', 'Anaclose story', 'Anatafuta stage'],
    ['Anacheki hali ama anasalimia', 'Anaomba loan', 'Anamaliza story', 'Anatafuta stage']
  ],
  [
    ['To become financially successful', 'To lose your phone', 'To travel by matatu', 'To cook ugali'],
    ['Kufanikiwa kifedha', 'Kupoteza simu', 'Kusafiri kwa matatu', 'Kupika ugali'],
    ['Kuomoka kwa pesa', 'Kupoteza simu', 'Kupanda mat', 'Kupika ugali'],
    ['Kufanikiwa kwa pesa', 'Kupoteza simu', 'Kupanda mat', 'Kupika ugali']
  ],
  [
    ['They are alert or ready', 'They are asleep', 'They are lost', 'They are eating'],
    ['Wako macho au tayari', 'Wamelala', 'Wamepotea', 'Wanapika'],
    ['Wako rada na wako ready', 'Wamelala', 'Wamepotea', 'Wanapika'],
    ['Wako alert na wako ready', 'Wamelala', 'Wamepotea', 'Wanapika']
  ],
  [
    ['I am relaxed or taking it easy', 'I am in a hurry', 'I am angry', 'I am lost'],
    ['Nimetulia au napumzika', 'Nina haraka', 'Nimekasirika', 'Nimepotea'],
    ['Nimetulia tu', 'Niko mbio', 'Nimejam', 'Nimepotea'],
    ['Nimetulia tu, napunguza pressure', 'Niko mbio', 'Nimejam', 'Nimepotea']
  ],
  [
    ['To die or be exhausted, depending on context', 'To dance all night', 'To send money', 'To board a matatu'],
    ['Kufa au kuchoka sana, kutegemea muktadha', 'Kucheza usiku kucha', 'Kutuma pesa', 'Kupanda matatu'],
    ['Kufa ama kuchoka mbaya, kulingana na context', 'Kudance usiku mzima', 'Kutuma pesa', 'Kupanda mat'],
    ['Kufa ama kuchoka sana—context ndio judge', 'Kudance usiku mzima', 'Kutuma pesa', 'Kupanda mat']
  ]
];

let quizIndex = 0;
categoryRows.forEach(row => {
  const [category, pack, type, english, swahili, sheng, mixed, tags = []] = row;
  const prompt = t(english, swahili, sheng, mixed);
  const currentQuizIndex = category === 'sheng-battle' ? quizIndex++ : -1;
  const quizChoices = currentQuizIndex >= 0 ? QUIZ_CHOICES[currentQuizIndex] : null;
  const choiceLocales = quizChoices && {
    english: quizChoices[0],
    swahili: quizChoices[1],
    sheng: quizChoices[2],
    mixed: quizChoices[3]
  };
  addQuestion({
    id: `${category}-${questionBank.length}`,
    category, pack, prompt,
    answerType: type === 'truth' ? 'choice' : type,
    choiceSet: type === 'quiz' ? null : type === 'player' ? 'players' : type === 'truth' ? 'truth' :
      type === 'text' ? null : type === 'challenge' ? 'challenge' : 'reactions',
    choices: choiceLocales,
    correctChoiceIndex: type === 'quiz' ? 0 : undefined,
    tags: [
      ...tags,
      ...(pack === 'matatu-madness' || pack === 'nairobi-vibes' ? ['nairobi'] : []),
      ...(category === 'romantic-comedy' ? ['romance'] : [])
    ],
    choiceTags: category === 'romantic-comedy' ? { 1: ['drama'] } : {},
    explanation: type === 'quiz' ? t(
      'Meanings shift with place and context—ask the speaker if the vibe is unclear.',
      'Maana hubadilika kulingana na muktadha—uliza msemaji ikiwa haiko wazi.',
      'Meaning hubadilika na context—ukiwa na doubt, uliza mtu amesema nini.',
      'Meaning hubadilika na context—ukishindwa, uliza wasee wanamaanisha nini.'
    ) : undefined,
    modes: category === 'romantic-comedy' ? ['romance', 'comedy', 'mind-reader'] :
      category === 'mini-challenge' ? ['comedy', 'romance', 'savage'] :
      category === 'truth-bluff' ? ['comedy', 'savage', 'mind-reader'] :
      ['comedy', 'savage', 'mind-reader']
  });
});

const ACHIEVEMENTS = [
  { id: 'ceo-wa-drama', label: t('CEO wa Drama', 'CEO wa Drama', 'CEO wa Drama', 'CEO wa Drama'), icon: '🎭', description: t('Picked two dramatic responses.', 'Ulichagua majibu mawili ya drama.', 'Umechagua majibu mawili ya drama.', 'Umechagua majibu mbili za drama.') },
  { id: 'professional-overthinker', label: t('Professional Overthinker', 'Mtaalamu wa Overthinking', 'Pro wa Ku-overthink', 'Pro wa Overthinking'), icon: '🧠', description: t('Predicted three partner answers correctly.', 'Ulikisia majibu matatu ya mwenzako vizuri.', 'Umeguess majibu matatu ya beshte yako sawa.', 'Umeguess majibu tatu za mwenzako sawa.') },
  { id: 'msee-wa-story', label: t('Msee wa Story', 'Mtaalamu wa Story', 'Msee wa Story', 'Msee wa Story'), icon: '📖', description: t('Completed a creative story answer.', 'Ulikamilisha jibu la story kwa ubunifu.', 'Umemalizia story na creativity.', 'Umemalizia story na ubunifu.') },
  { id: 'certified-sleep-champion', label: t('Certified Sleep Champion', 'Bingwa wa Usingizi', 'Mabingwa wa Kulala', 'Bingwa wa Kulala'), icon: '😴', description: t('Chose the sleep-first plan.', 'Ulichagua mpango wa kulala kwanza.', 'Umechagua kulala kwanza.', 'Umechagua kulala kwanza.') },
  { id: 'budget-minister', label: t('Budget Minister', 'Waziri wa Bajeti', 'Minister wa Budget', 'Minister wa Budget'), icon: '💸', description: t('Chose a budget-friendly move.', 'Ulichagua hatua ya kuokoa pesa.', 'Umechagua plan ya ku-save pesa.', 'Umechagua plan ya ku-save pesa.') },
  { id: 'master-wa-excuses', label: t('Master wa Excuses', 'Bingwa wa Visingizio', 'Master wa Excuses', 'Master wa Excuses'), icon: '🙈', description: t('Owned a classic excuse.', 'Ulikubali kisingizio cha kawaida.', 'Umekubali excuse ya ukweli.', 'Umekubali excuse ya kawaida.') },
  { id: 'nairobi-survivor', label: t('Nairobi Survivor', 'Mshindi wa Nairobi', 'Nairobi Survivor', 'Nairobi Survivor'), icon: '🚦', description: t('Finished a game full of Nairobi energy.', 'Ulikamilisha mchezo wenye pilka pilka za Nairobi.', 'Umemaliza game na pilka pilka za Nai.', 'Umemaliza game na pilka pilka za Nairobi.') },
  { id: 'romantic-comedian', label: t('Romantic Comedian', 'Mchekeshaji wa Mapenzi', 'Comedian wa Mapenzi', 'Comedian wa Mapenzi'), icon: '❤️', description: t('Finished a romance game with a correct prediction.', 'Ulikamilisha mchezo wa mapenzi na kukisia vizuri.', 'Umemaliza game ya mapenzi na ku-guess sawa.', 'Umemaliza game ya mapenzi na ku-guess sawa.') }
];

const REVEAL_MESSAGES = {
  english: {
    match: ['Match made in heaven—or excellent research?', 'Same wavelength. Slightly suspicious.'],
    miss: ['Aii! You two are on different planets today.', 'The evidence says: please compare notes.'],
    partial: ['One of you has been paying attention!', 'Close enough to start a debate.']
  },
  swahili: {
    match: ['Mmeelewana kabisa—ama mmefanya research?', 'Mko wavelength moja. Inashangaza kidogo.'],
    miss: ['Aii! Leo mko sayari tofauti.', 'Ushahidi unasema mlinganishe majibu.'],
    partial: ['Mmoja wenu amekuwa akisikiliza!', 'Karibu—hii sasa italeta mjadala.']
  },
  sheng: {
    match: ['Mko same WhatsApp group kweli!', 'Mme-match safi—kuna research imefanyika?'],
    miss: ['Aii! Leo mko different planets!', 'Hii answer imeleta evidence ya story tofauti.'],
    partial: ['Mmoja wenu ako rada kabisa!', 'Mko karibu—sasa story iendelee.']
  },
  mixed: {
    match: ['Match made in heaven ama mmefanya research?', 'Mko same WhatsApp group kweli!'],
    miss: ['Aii! Hapa mmeelewana vibaya.', 'Mko different planets leo—hii answer imeleta evidence!'],
    partial: ['Mmoja wenu ako rada kabisa!', 'Karibu—hii sasa italeta story.']
  }
};

function localize(value, language) {
  if (typeof value === 'string') return value;
  return value?.[language] || value?.mixed || value?.english || '';
}

function getCompatibleCategories(mode, pack) {
  const eligible = questionBank.filter(question =>
    question.modes.includes(mode) && (pack === 'mixed' || question.pack === pack)
  );
  return CATEGORIES
    .filter(category => category.id !== 'classic' && (
      category.id === 'mixed'
        ? eligible.length >= 5
        : eligible.filter(question => question.category === category.id).length >= 5
    ))
    .map(category => category.id);
}

function getOptions() {
  const categoryCompatibility = {};
  const packCompatibility = {};
  for (const mode of MODES.filter(item => item.id !== 'classic')) {
    for (const pack of PACKS) {
      categoryCompatibility[`${mode.id}:${pack.id}`] =
        getCompatibleCategories(mode.id, pack.id);
    }
    for (const category of CATEGORIES.filter(item => item.id !== 'classic')) {
      packCompatibility[`${mode.id}:${category.id}`] = PACKS
        .filter(pack => categoryCompatibility[`${mode.id}:${pack.id}`].includes(category.id))
        .map(pack => pack.id);
    }
  }
  return {
    experiences: EXPERIENCES,
    languages: LANGUAGES,
    modes: MODES,
    packs: PACKS,
    categories: CATEGORIES,
    categoryCompatibility,
    packCompatibility,
    timers: [0, 10, 15, 20],
    achievements: ACHIEVEMENTS
  };
}

function getRevealMessage(language, correctPredictions, random = Math.random) {
  const messages = REVEAL_MESSAGES[language] || REVEAL_MESSAGES.mixed;
  const band = correctPredictions >= 2 ? 'match' : correctPredictions === 0 ? 'miss' : 'partial';
  const choices = messages[band];
  return choices[Math.floor(random() * choices.length)];
}

function questionChoices(question, language) {
  if (question.choices) return question.choices[language] || question.choices.mixed;
  if (!question.choiceSet) return [];
  return CHOICE_SETS[question.choiceSet][language] || CHOICE_SETS[question.choiceSet].mixed;
}

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function buildRound(question, language, baseRound = null, timerSeconds = 0) {
  const category = CATEGORIES.find(entry => entry.id === question.category);
  const choices = questionChoices(question, language);
  const predictionChoices = question.answerType === 'text'
    ? CHOICE_SETS.storyStyles[language]
    : choices;
  return {
    id: question.id,
    category: baseRound?.category || category?.label || 'The Other Side of Us',
    scenario: baseRound
      ? baseRound.scenario
      : category?.label || 'A shared moment',
    question: localize(question.prompt, language),
    choices,
    predictionChoices,
    answerType: question.answerType,
    correctChoiceIndex: question.correctChoiceIndex,
    explanation: localize(question.explanation, language),
    privateInfo: baseRound?.playerInfo,
    tags: question.tags || [],
    choiceTags: question.choiceTags || {},
    timerSeconds,
    roundId: question.roundId || null
  };
}

function chooseWithoutRepeats(candidates, previousIds, random, count) {
  const unseen = candidates.filter(question => !previousIds.has(question.id));
  const fresh = shuffle(unseen, random);
  if (fresh.length >= count) return fresh.slice(0, count);
  const seen = new Set(fresh.map(question => question.id));
  return [...fresh, ...shuffle(candidates.filter(question => !seen.has(question.id)), random)]
    .slice(0, count);
}

function selectClassicRounds(scenarios, config, previousIds, random) {
  return scenarios.map(baseRound => {
    let candidates = questionBank.filter(question =>
      question.category === 'classic' && question.roundId === baseRound.id
    );
    if (config.pack !== 'mixed') {
      const packCandidates = candidates.filter(question => question.pack === config.pack);
      if (packCandidates.length) candidates = packCandidates;
    }
    if (config.mode !== 'classic') {
      const modeCandidates = candidates.filter(question => question.modes.includes(config.mode));
      if (modeCandidates.length) candidates = modeCandidates;
    }
    const original = {
      id: `${baseRound.id}-original`,
      category: 'classic',
      roundId: baseRound.id,
      pack: 'mixed',
      prompt: t(baseRound.question, baseRound.question, baseRound.question, baseRound.question),
      choiceSet: null,
      choices: {
        english: baseRound.choices,
        swahili: baseRound.choices,
        sheng: baseRound.choices,
        mixed: baseRound.choices
      },
      answerType: 'choice',
      tags: []
    };
    if (config.language === 'english') candidates = [original, ...candidates];
    if (!candidates.length) candidates = [original];
    const selected = chooseWithoutRepeats(candidates, previousIds, random, 1)[0];
    return buildRound(selected, config.language, baseRound, config.timerSeconds);
  });
}

function selectKenyanRounds(config, previousIds, random) {
  const matches = questionBank.filter(question =>
    (config.category === 'mixed' || question.category === config.category)
      && (config.pack === 'mixed' || question.pack === config.pack)
      && question.modes.includes(config.mode)
  );
  if (matches.length < 5) throw new Error('This game mode, category, and content pack combination is unavailable');
  const rounds = chooseWithoutRepeats(matches, previousIds, random, 5)
    .map(question => buildRound(question, config.language, null, config.timerSeconds));
  if (random() < 0.2) {
    const usedIds = new Set([...previousIds, ...rounds.map(round => round.id)]);
    const surpriseCandidates = questionBank.filter(question =>
      ['funny-predictions', 'complete-story', 'mini-challenge'].includes(question.category)
        && (config.pack === 'mixed' || question.pack === config.pack)
        && question.modes.includes(config.mode)
        && !usedIds.has(question.id)
    );
    if (surpriseCandidates.length) {
      const surprise = buildRound(
        shuffle(surpriseCandidates, random)[0],
        config.language,
        null,
        config.timerSeconds
      );
      surprise.isSurpriseRound = true;
      rounds[Math.floor(random() * rounds.length)] = surprise;
    }
  }
  return rounds;
}

function createRounds(scenarios, config, previousQuestionIds = [], random = Math.random) {
  const previous = new Set(previousQuestionIds);
  return config.experience === 'classic'
    ? selectClassicRounds(scenarios, config, previous, random)
    : selectKenyanRounds(config, previous, random);
}

module.exports = {
  LANGUAGES,
  EXPERIENCES,
  MODES,
  PACKS,
  CATEGORIES,
  ACHIEVEMENTS,
  questionBank,
  getOptions,
  getRevealMessage,
  localize,
  getCompatibleCategories,
  createRounds,
  shuffle
};
