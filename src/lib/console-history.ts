// src/lib/console-history.ts

export interface ConsoleMilestone {
  title: string;
  year: number;
  description: { en: string; de: string };
}

export interface ConsoleFacts {
  unitsSold: string;
  cpu: string;
  gameLibrary: { en: string; de: string };
  launchPrice: string;
}

export interface ConsoleHistoryEntry {
  platformId: string;
  manufacturer: string;
  releaseYear: number;
  alternateNames: string[];
  history: { en: string[]; de: string[] };
  facts: ConsoleFacts;
  milestones: ConsoleMilestone[];
}

export const CONSOLE_HISTORY: ConsoleHistoryEntry[] = [
  // ── Nintendo Handhelds ──
  {
    platformId: "gb",
    manufacturer: "Nintendo",
    releaseYear: 1989,
    alternateNames: ["Game Boy (weltweit)", "DMG-01"],
    history: {
      en: [
        "When Gunpei Yokoi designed the Game Boy, he deliberately chose a monochrome screen over a color display. This decision was fiercely criticized internally at Nintendo — competitors like the Atari Lynx and Sega's Game Gear already offered color. But Yokoi understood that a monochrome screen consumed less power, enabling longer play sessions and a more affordable price point.",
        "The decisive masterstroke was bundling Tetris instead of a Mario game. Tetris appealed to an entirely new demographic — adults, women, casual players. The Game Boy became a cultural phenomenon: on flights, in waiting rooms, and during school breaks, it was omnipresent. Even during the Gulf War in 1991, soldiers brought their Game Boys along — one unit survived a bombing raid and continued to function despite its melted casing.",
        "With over 118 million units sold (including the Game Boy Color), Yokoi's philosophy of 'Lateral Thinking with Withered Technology' proved that raw power doesn't win markets — clever design does. This principle has shaped Nintendo to this day, from the DS to the Switch."
      ],
      de: [
        "Als Gunpei Yokoi den Game Boy entwarf, wählte er bewusst einen monochromen Bildschirm statt eines Farbdisplays. Diese Entscheidung wurde intern bei Nintendo heftig kritisiert — Konkurrenten wie der Atari Lynx und Segas Game Gear boten bereits Farbe. Doch Yokoi wusste: Ein monochromer Bildschirm verbrauchte weniger Strom, was längere Spielzeiten und einen günstigeren Preis ermöglichte.",
        "Der entscheidende Coup war die Bündlung mit Tetris statt eines Mario-Spiels. Tetris sprach eine völlig neue Zielgruppe an — Erwachsene, Frauen, Gelegenheitsspieler. Der Game Boy wurde zum kulturellen Phänomen: Auf Flügen, in Wartezimmern und Schulpausen war er allgegenwärtig. Selbst im Golfkrieg 1991 nahmen Soldaten ihre Game Boys mit — ein Gerät überlebte einen Bombenangriff und funktionierte trotz geschmolzenem Gehäuse weiter.",
        "Mit über 118 Millionen verkauften Einheiten (inklusive Game Boy Color) bewies Yokois Philosophie 'Laterales Denken mit veralteter Technologie', dass nicht rohe Leistung, sondern cleveres Design den Markt gewinnt. Dieses Prinzip prägte Nintendo bis heute — vom DS bis zur Switch."
      ],
    },
    facts: {
      unitsSold: "118,69 Millionen (inkl. GBC)",
      cpu: "Sharp LR35902 (4,19 MHz)",
      gameLibrary: { en: "1,046 official games", de: "1.046 offizielle Spiele" },
      launchPrice: "12.500 Yen / $89,99 (1989)",
    },
    milestones: [
      { title: "Tetris", year: 1989, description: { en: "The bundled game turned the Game Boy into a mass-market product, reaching entirely new audiences", de: "Das Bundlespiel machte den Game Boy zum Massenprodukt und erreichte völlig neue Zielgruppen" } },
      { title: "Pokemon Rot/Blau", year: 1996, description: { en: "Triggered a worldwide collecting craze and rescued the Game Boy from the end of its lifecycle", de: "Löste eine weltweite Sammelwut aus und rettete den Game Boy vor dem Ende seines Lebenszyklus" } },
      { title: "Super Mario Land", year: 1989, description: { en: "Proved that full-fledged Mario adventures were possible even on a handheld", de: "Bewies, dass vollwertige Mario-Abenteuer auch auf einem Handheld möglich sind" } },
      { title: "The Legend of Zelda: Link's Awakening", year: 1993, description: { en: "One of the first handheld games to feature a deeply emotional and profound story", de: "Eines der ersten Handheld-Spiele mit einer tiefgründigen, emotionalen Geschichte" } },
      { title: "Game Boy Camera/Printer", year: 1998, description: { en: "Turned the Game Boy into the first portable digital camera for the mass market", de: "Machte den Game Boy zur ersten tragbaren Digitalkamera für den Massenmarkt" } },
    ],
  },
  {
    platformId: "gbc",
    manufacturer: "Nintendo",
    releaseYear: 1998,
    alternateNames: ["Game Boy Color", "GBC", "CGB-001"],
    history: {
      en: [
        "The Game Boy Color was Nintendo's answer to growing criticism of the original Game Boy's outdated monochrome display. With a color screen capable of displaying up to 56 colors simultaneously, it offered a significant visual leap — while remaining fully backward compatible with the entire Game Boy catalog.",
        "The true success of the Game Boy Color was inseparable from Pokemon. The release of Pokemon Gold and Silver in 2000 drove sales to astronomical heights. The game cleverly exploited the new hardware capabilities — the real-time day-night cycle was revolutionary for its time.",
        "Although the GBC was technically only an incremental upgrade, it secured Nintendo's dominance in the handheld market for years to come. By the time the Game Boy Advance arrived in 2001, the Game Boy family had sold over 200 million units combined — a record that would only be broken by the Nintendo DS."
      ],
      de: [
        "Der Game Boy Color war Nintendos Antwort auf die wachsende Kritik am veralteten Monochrom-Display des originalen Game Boy. Mit einem Farbbildschirm, der bis zu 56 Farben gleichzeitig darstellen konnte, bot er einen deutlichen visuellen Sprung — blieb aber gleichzeitig rückwärtskompatibel mit dem gesamten Game-Boy-Katalog.",
        "Der wahre Erfolg des Game Boy Color war untrennbar mit Pokemon verbunden. Die Veröffentlichung von Pokemon Gold und Silber im Jahr 2000 trieb die Verkaufszahlen in astronomische Höhen. Das Spiel nutzte die neuen Fähigkeiten der Hardware geschickt aus — der Tag-Nacht-Zyklus in Echtzeit war für damalige Verhältnisse revolutionär.",
        "Obwohl der GBC technisch nur ein inkrementelles Upgrade war, sicherte er Nintendos Dominanz im Handheld-Markt für weitere Jahre. Bis zum Erscheinen des Game Boy Advance 2001 hatte die Game-Boy-Familie insgesamt über 200 Millionen Einheiten verkauft — ein Rekord, der erst vom Nintendo DS gebrochen wurde."
      ],
    },
    facts: {
      unitsSold: "49,02 Millionen",
      cpu: "Sharp LR35902 (8,39 MHz, doppelte Taktrate)",
      gameLibrary: { en: "576 exclusive GBC games", de: "576 exklusive GBC-Spiele" },
      launchPrice: "8.900 Yen / $79,99 (1998)",
    },
    milestones: [
      { title: "Pokemon Gold/Silber", year: 1999, description: { en: "Introduced the real-time day-night cycle and doubled the game world with the Kanto region", de: "Führte den Echtzeit-Tag-Nacht-Zyklus ein und verdoppelte die Spielwelt mit der Kanto-Region" } },
      { title: "The Legend of Zelda: Oracle of Ages/Seasons", year: 2001, description: { en: "Two interconnected adventures developed by Capcom in collaboration with Nintendo", de: "Zwei miteinander verknüpfte Abenteuer, entwickelt von Capcom in Zusammenarbeit mit Nintendo" } },
      { title: "Dragon Quest III (GBC)", year: 2000, description: { en: "Proved that expansive RPGs could work brilliantly on the small handheld", de: "Bewies, dass umfangreiche RPGs auf dem kleinen Handheld hervorragend funktionieren" } },
      { title: "Metal Gear Solid: Ghost Babel", year: 2000, description: { en: "A full-fledged Metal Gear experience on a handheld that thrilled critics", de: "Eine vollwertige Metal-Gear-Erfahrung auf dem Handheld, die Kritiker begeisterte" } },
    ],
  },
  {
    platformId: "gba",
    manufacturer: "Nintendo",
    releaseYear: 2001,
    alternateNames: ["Game Boy Advance", "GBA", "AGB-001"],
    history: {
      en: [
        "The Game Boy Advance was Nintendo's first 32-bit handheld, bringing Super Nintendo-level power into your pocket. The landscape form factor broke with the Game Boy's vertical tradition and offered a wider display particularly suited for side-scrollers and role-playing games. The hardware was powerful enough that many SNES classics could be ported nearly flawlessly.",
        "In 2003, the GBA SP arrived — a redesigned model with a clamshell design and the long-awaited backlit screen. This redesign was a massive seller and significantly extended the platform's lifecycle. Nintendo once again demonstrated its knack for creating new purchase incentives through hardware revisions.",
        "The GBA became home to some of the finest 2D games ever made. From the Metroid remakes to the Golden Sun RPGs to Fire Emblem making its first leap to the West — the library was extraordinarily diverse. Third-party publishers like Square Enix also supported the platform with titles such as Final Fantasy Tactics Advance."
      ],
      de: [
        "Der Game Boy Advance war Nintendos erster 32-Bit-Handheld und brachte die Leistung eines Super Nintendo in die Hosentasche. Das Querformat-Design brach mit der vertikalen Tradition des Game Boy und bot ein breiteres Display, das sich besonders für Sidescroller und Rollenspiele eignete. Die Hardware war so leistungsfähig, dass viele SNES-Klassiker nahezu perfekt portiert werden konnten.",
        "2003 erschien der GBA SP — ein überarbeitetes Modell mit Klappdesign und dem lang ersehnten beleuchteten Bildschirm. Dieses Redesign war ein Verkaufsschlager und verlängerte den Lebenszyklus der Plattform erheblich. Nintendo bewies damit erneut sein Geschick, durch Hardware-Revisionen neue Kaufanreize zu schaffen.",
        "Der GBA wurde zur Heimat einiger der besten 2D-Spiele aller Zeiten. Von den Metroid-Remakes über die Golden-Sun-RPGs bis hin zu Fire Emblem, das erstmals den Sprung in den Westen schaffte — die Bibliothek war außergewöhnlich vielfältig. Auch Drittanbieter wie Square Enix unterstützten die Plattform mit Titeln wie Final Fantasy Tactics Advance."
      ],
    },
    facts: {
      unitsSold: "81,51 Millionen",
      cpu: "ARM7TDMI (16,78 MHz)",
      gameLibrary: { en: "1,538 official games", de: "1.538 offizielle Spiele" },
      launchPrice: "9.800 Yen / $99,99 (2001)",
    },
    milestones: [
      { title: "Pokemon Rubin/Saphir", year: 2002, description: { en: "Introduced abilities and double battles, selling over 16 million units", de: "Führte Fähigkeiten und Doppelkämpfe ein und verkaufte über 16 Millionen Einheiten" } },
      { title: "Metroid Fusion", year: 2002, description: { en: "Brought the Metroid franchise back with an atmospherically dense experience", de: "Brachte das Metroid-Franchise zurück und bot eine atmosphärisch dichte Erfahrung" } },
      { title: "Fire Emblem (Westen)", year: 2003, description: { en: "First localization of the series for Western markets — established a global fanbase", de: "Erstmalige Lokalisierung der Serie für westliche Märkte — begründete eine globale Fangemeinde" } },
      { title: "Golden Sun", year: 2001, description: { en: "RPG masterpiece by Camelot with impressive pseudo-3D graphics on a handheld", de: "RPG-Meisterwerk von Camelot mit beeindruckender Pseudo-3D-Grafik auf dem Handheld" } },
      { title: "The Legend of Zelda: The Minish Cap", year: 2004, description: { en: "A Capcom-developed Zelda adventure with a charming shrinking mechanic", de: "Von Capcom entwickeltes Zelda-Abenteuer mit charmanter Schrumpf-Mechanik" } },
    ],
  },
  {
    platformId: "nds",
    manufacturer: "Nintendo",
    releaseYear: 2004,
    alternateNames: ["Nintendo DS", "DS", "Dual Screen", "NTR-001"],
    history: {
      en: [
        "When Nintendo announced the DS in 2004, many observers were skeptical. Two screens? A touchscreen? A microphone? It sounded like a gimmick, not a revolution. But Satoru Iwata, Nintendo's president at the time, had a clear vision: expand the circle of gamers. The DS was meant to appeal not just to hardcore gamers, but also to people who had never held a controller before.",
        "This strategy paid off spectacularly. Brain Age, Nintendogs, and Cooking Mama reached millions of non-gamers — older adults, women, families. In Japan, the DS became a social phenomenon: commuters played Brain Age on the subway, families gathered around Nintendogs. The touchscreen controls made games intuitively accessible.",
        "With over 154 million units sold, the DS became the best-selling portable console of all time and ranks second overall only behind the PlayStation 2. The enormous library of over 1,800 games encompasses everything from RPG masterpieces like Dragon Quest IX to creative gems like Elite Beat Agents."
      ],
      de: [
        "Als Nintendo 2004 den DS ankündigte, waren viele Beobachter skeptisch. Zwei Bildschirme? Ein Touchscreen? Ein Mikrofon? Das klang nach einem Gimmick, nicht nach einer Revolution. Doch Satoru Iwata, Nintendos damaliger Präsident, hatte eine klare Vision: Den Kreis der Spieler erweitern. Der DS sollte nicht nur Hardcore-Gamer ansprechen, sondern auch Menschen, die noch nie einen Controller in der Hand gehalten hatten.",
        "Diese Strategie ging spektakulär auf. Brain Age, Nintendogs und Cooking Mama erreichten Millionen von Nichtspielern — ältere Menschen, Frauen, Familien. In Japan wurde der DS zum gesellschaftlichen Phänomen: Pendler spielten Brain Age in der U-Bahn, Familien versammelten sich um Nintendogs. Die Touchscreen-Steuerung machte Spiele intuitiv zugänglich.",
        "Mit über 154 Millionen verkauften Einheiten wurde der DS zur meistverkauften tragbaren Konsole aller Zeiten und liegt in der Gesamtwertung nur hinter der PlayStation 2. Die enorme Bibliothek von über 1.800 Spielen umfasst alles von RPG-Meisterwerken wie Dragon Quest IX bis zu kreativen Perlen wie Elite Beat Agents."
      ],
    },
    facts: {
      unitsSold: "154,02 Millionen",
      cpu: "ARM946E-S (67 MHz) + ARM7TDMI (33 MHz)",
      gameLibrary: { en: "1,831 official games", de: "1.831 offizielle Spiele" },
      launchPrice: "15.000 Yen / $149,99 (2004)",
    },
    milestones: [
      { title: "Nintendogs", year: 2005, description: { en: "Virtual pet game that turned the DS into a mainstream phenomenon", de: "Virtuelles Haustier-Spiel, das den DS zum Mainstream-Phänomen machte" } },
      { title: "New Super Mario Bros.", year: 2006, description: { en: "Revival of 2D Mario with over 30 million units sold", de: "Wiederbelebung des 2D-Mario mit über 30 Millionen verkauften Einheiten" } },
      { title: "Pokemon Diamant/Perl", year: 2006, description: { en: "First fourth-generation Pokemon with online trading via Nintendo Wi-Fi Connection", de: "Erstes Pokemon der vierten Generation mit Online-Tausch über die Nintendo Wi-Fi Connection" } },
      { title: "Professor Layton", year: 2007, description: { en: "Charming puzzle series by Level-5 that masterfully combined puzzles and narrative", de: "Charmante Rätsel-Serie von Level-5, die Puzzle und Erzählung meisterhaft verband" } },
      { title: "Dragon Quest IX", year: 2009, description: { en: "Over 5 million units in Japan alone — the best-selling DS game in the country", de: "Über 5 Millionen Einheiten allein in Japan — das meistverkaufte DS-Spiel im Land" } },
    ],
  },
  {
    platformId: "n3ds",
    manufacturer: "Nintendo",
    releaseYear: 2011,
    alternateNames: ["Nintendo 3DS", "3DS", "CTR-001"],
    history: {
      en: [
        "The Nintendo 3DS dared to attempt something the entire industry considered impossible: glasses-free 3D on a portable device. The autostereoscopic technology produced a convincing depth effect that drew gasps at its first E3 presentation in 2010. But the launch in March 2011 was rocky — the steep $249 price tag and thin launch lineup led to disappointing sales figures.",
        "Nintendo reacted drastically: just five months after launch, they slashed the price by a third to $169. Early adopters received 20 free Virtual Console games as compensation through the 'Ambassador Program.' This aggressive move, combined with blockbuster titles like Super Mario 3D Land and Mario Kart 7, turned the tide.",
        "In 2014, the 'New Nintendo 3DS' arrived with improved 3D tracking that solved the original's viewing angle problems, along with a C-Stick and additional shoulder buttons. The 3DS became home to outstanding first-party titles and evolved into one of Nintendo's strongest platforms — despite growing competition from smartphones."
      ],
      de: [
        "Der Nintendo 3DS wagte etwas, das die gesamte Industrie für unmöglich hielt: brillenloses 3D auf einem tragbaren Gerät. Die autostereoskopische Technologie erzeugte einen überzeugenden Tiefeneffekt, der bei der ersten E3-Präsentation 2010 für Staunen sorgte. Doch der Launch im März 2011 war holprig — der hohe Preis von $249 und das dünne Startsortiment führten zu enttäuschenden Verkaufszahlen.",
        "Nintendo reagierte drastisch: Nur fünf Monate nach dem Launch senkte man den Preis um ein Drittel auf $169. Frühkäufer erhielten als Entschädigung 20 kostenlose Virtual-Console-Spiele über das 'Ambassador-Programm'. Dieser aggressive Schritt, kombiniert mit Blockbuster-Titeln wie Super Mario 3D Land und Mario Kart 7, wendete das Blatt.",
        "2014 erschien der 'New Nintendo 3DS' mit verbessertem 3D-Tracking, das die Blickwinkel-Probleme des Originals löste, sowie einem C-Stick und zusätzlichen Schultertasten. Der 3DS wurde zur Heimat herausragender First-Party-Titel und entwickelte sich zu einer der stärksten Nintendo-Plattformen — trotz der wachsenden Konkurrenz durch Smartphones."
      ],
    },
    facts: {
      unitsSold: "75,94 Millionen",
      cpu: "ARM11 MPCore (268 MHz, Dual-Core)",
      gameLibrary: { en: "1,340+ games", de: "1.340+ Spiele" },
      launchPrice: "25.000 Yen / $249,99 (2011)",
    },
    milestones: [
      { title: "Super Mario 3D Land", year: 2011, description: { en: "Fused 2D and 3D Mario gameplay and ingeniously used the 3D effect for puzzles", de: "Verschmolz 2D- und 3D-Mario-Gameplay und nutzte den 3D-Effekt genial für Rätsel" } },
      { title: "Pokemon X/Y", year: 2013, description: { en: "First fully three-dimensional mainline Pokemon title with a worldwide simultaneous release", de: "Erster vollständig dreidimensionaler Pokemon-Hauptteil mit weltweitem Simultanrelease" } },
      { title: "The Legend of Zelda: A Link Between Worlds", year: 2013, description: { en: "Brilliant reimagining of A Link to the Past with an innovative wall-merging mechanic", de: "Brillante Neuinterpretation von A Link to the Past mit innovativer Wand-Mechanik" } },
      { title: "Fire Emblem: Awakening", year: 2012, description: { en: "Saved the Fire Emblem series from cancellation and turned it into a mainstream hit", de: "Rettete die Fire-Emblem-Serie vor der Einstellung und machte sie zum Mainstream-Hit" } },
      { title: "Monster Hunter 4 Ultimate", year: 2014, description: { en: "Defined the cooperative handheld experience and sold millions in Japan", de: "Definierte das kooperative Handheld-Erlebnis und verkaufte Millionen in Japan" } },
    ],
  },
  {
    platformId: "virtualboy",
    manufacturer: "Nintendo",
    releaseYear: 1995,
    alternateNames: ["Virtual Boy", "VUE-001"],
    history: {
      en: [
        "The Virtual Boy was Gunpei Yokoi's final project at Nintendo — and his greatest commercial failure. The idea was visionary: a portable virtual reality system for the mass market. But technical limitations and cost constraints resulted in a device that failed to convince in any category. The monochrome red LED display caused headaches and nausea in many users.",
        "The design was neither portable nor stationary — the player had to peer into a device mounted on a stand in an uncomfortable posture. The 3D effect was impressive, but the lack of color and ergonomic problems made longer play sessions agonizing. Nintendo attempted to position the Virtual Boy as a bridge product between the Game Boy and the upcoming N64, but the strategy fell flat.",
        "After just six months and 22 released games, Nintendo discontinued production. The Virtual Boy sold only 770,000 units — fewer than any other Nintendo product. Nevertheless, it is a sought-after collector's item today, and some games like Virtual Boy Wario Land are considered hidden gems."
      ],
      de: [
        "Der Virtual Boy war Gunpei Yokois letztes Projekt bei Nintendo — und sein größter kommerzieller Misserfolg. Die Idee war visionär: ein tragbares Virtual-Reality-System für den Massenmarkt. Doch technische Limitierungen und Kosteneinschränkungen führten zu einem Gerät, das in keiner Kategorie überzeugte. Der monochrome rote LED-Display verursachte bei vielen Nutzern Kopfschmerzen und Übelkeit.",
        "Das Design war weder tragbar noch stationär — der Spieler musste in ein auf einem Ständer montiertes Gerät schauen, in einer unbequemen Haltung. Der 3D-Effekt war zwar beeindruckend, aber das Fehlen von Farbe und die ergonomischen Probleme machten längere Spielsitzungen zur Qual. Nintendo versuchte, den Virtual Boy als Brückenprodukt zwischen Game Boy und dem kommenden N64 zu positionieren, doch diese Strategie ging nicht auf.",
        "Nach nur sechs Monaten und 22 veröffentlichten Spielen stellte Nintendo die Produktion ein. Der Virtual Boy verkaufte nur 770.000 Einheiten — weniger als jedes andere Nintendo-Produkt. Trotzdem ist er heute ein begehrtes Sammlerstück, und einige Spiele wie Virtual Boy Wario Land gelten als versteckte Juwelen."
      ],
    },
    facts: {
      unitsSold: "770.000",
      cpu: "NEC V810 (20 MHz)",
      gameLibrary: { en: "22 official games", de: "22 offizielle Spiele" },
      launchPrice: "15.000 Yen / $179,95 (1995)",
    },
    milestones: [
      { title: "Mario's Tennis", year: 1995, description: { en: "The bundled game demonstrated the 3D effect best but was thin on content", de: "Das Bundlespiel demonstrierte den 3D-Effekt am besten, war aber inhaltlich dünn" } },
      { title: "Virtual Boy Wario Land", year: 1995, description: { en: "The platform's best game — a full-fledged platformer with clever use of 3D", de: "Das beste Spiel der Plattform — ein vollwertiges Jump'n'Run mit cleverem 3D-Einsatz" } },
      { title: "Red Alarm", year: 1995, description: { en: "Wireframe shooter that showcased the hardware's 3D capabilities most impressively", de: "Drahtgitter-Shooter, der die 3D-Fähigkeiten der Hardware am eindrucksvollsten nutzte" } },
    ],
  },
  {
    platformId: "pokemini",
    manufacturer: "Nintendo / The Pokemon Company",
    releaseYear: 2001,
    alternateNames: ["Pokemon Mini", "PM"],
    history: {
      en: [
        "The Pokemon Mini was the smallest cartridge-based game console ever produced. Measuring just 74 x 58 x 23 mm, it fit effortlessly into any child's hand. Nintendo developed the device specifically as a Pokemon-licensed product for younger players — a niche between toy and game console.",
        "Despite its tiny size, the Pokemon Mini offered a surprising number of features: a motion sensor, an infrared port for multiplayer, a rumble motor, and even a built-in real-time clock. The monochrome display had a resolution of only 96 x 64 pixels, but the games used this limitation creatively.",
        "Commercially, the Pokemon Mini was not a success — only ten games were released, and the device was barely promoted outside Japan. However, it enjoys a loyal following in the homebrew scene to this day, with enthusiasts developing new games and tools for the platform."
      ],
      de: [
        "Der Pokemon Mini war die kleinste Spielkonsole mit Steckmodulen, die jemals produziert wurde. Mit Abmessungen von nur 74 x 58 x 23 mm passte er problemlos in jede Kinderhand. Nintendo entwickelte das Gerät speziell als Pokemon-Lizenzprodukt für jüngere Spieler — eine Nische zwischen Spielzeug und Spielkonsole.",
        "Trotz seiner winzigen Größe bot der Pokemon Mini überraschend viele Features: einen Bewegungssensor, einen Infrarot-Port für Multiplayer, einen Vibrationsmotor und sogar eine eingebaute Echtzeituhr. Das monochrome Display hatte eine Auflösung von nur 96 x 64 Pixeln, aber die Spiele nutzten diese Limitierung kreativ aus.",
        "Kommerziell war der Pokemon Mini kein Erfolg — es erschienen nur zehn Spiele, und das Gerät wurde außerhalb Japans kaum beworben. In der Homebrew-Szene erfreut er sich jedoch bis heute einer treuen Fangemeinde, die neue Spiele und Tools für die Plattform entwickelt."
      ],
    },
    facts: {
      unitsSold: "Unbekannt (geringe Stückzahl)",
      cpu: "Epson S1C88 (4 MHz)",
      gameLibrary: { en: "10 official games", de: "10 offizielle Spiele" },
      launchPrice: "4.980 Yen / $34,99 (2001)",
    },
    milestones: [
      { title: "Pokemon Party Mini", year: 2001, description: { en: "Bundled minigame collection that demonstrated the motion sensor and rumble motor", de: "Bundlespiel mit Minispielen, das den Bewegungssensor und Vibrationsmotor demonstrierte" } },
      { title: "Pokemon Puzzle Collection", year: 2001, description: { en: "Puzzle compilation that got the most out of the tiny display", de: "Puzzle-Sammlung, die das Beste aus dem winzigen Display herausholte" } },
      { title: "Pokemon Zany Cards", year: 2001, description: { en: "Card game with surprising strategic depth", de: "Kartenspiel mit überraschender strategischer Tiefe" } },
    ],
  },

  // ── Nintendo Home Consoles ──
  {
    platformId: "nes",
    manufacturer: "Nintendo",
    releaseYear: 1983,
    alternateNames: ["Famicom (Japan)", "NES (Nordamerika/Europa)"],
    history: {
      en: [
        "After the devastating video game crash of 1983, the North American gaming industry lay in ruins. Atari had flooded the market with subpar titles — consumer and retailer trust was shattered. In Japan, however, Nintendo was working on a console that would change everything: the Family Computer, or Famicom for short.",
        "Hiroshi Yamauchi, Nintendo's visionary president, introduced the 'Nintendo Seal of Quality' — a quality seal ensuring that only Nintendo-approved games could appear on the platform. Developers were limited to a maximum of five titles per year. This strict control saved not just Nintendo, but the entire video game industry.",
        "In North America, the Famicom was marketed as the 'Nintendo Entertainment System' — deliberately branded as an 'Entertainment System' rather than a 'video game console' to avoid the negative associations of the crash. The strategy worked: by 1990, an NES stood in one out of every three American households."
      ],
      de: [
        "Nach dem verheerenden Videospiel-Crash von 1983 lag die nordamerikanische Spieleindustrie in Trümmern. Atari hatte den Markt mit minderwertigen Titeln überschwemmt — das Vertrauen der Konsumenten und Händler war zerstört. In Japan hingegen arbeitete Nintendo an einer Konsole, die alles verändern sollte: dem Family Computer, kurz Famicom.",
        "Hiroshi Yamauchi, Nintendos visionärer Präsident, führte das 'Nintendo Seal of Quality' ein — ein Qualitätssiegel, das sicherstellte, dass nur von Nintendo geprüfte Spiele auf der Plattform erscheinen durften. Entwickler durften maximal fünf Titel pro Jahr veröffentlichen. Diese strenge Kontrolle rettete nicht nur Nintendo, sondern die gesamte Videospielindustrie.",
        "In Nordamerika wurde das Famicom als 'Nintendo Entertainment System' vermarktet — bewusst als 'Entertainment System' statt 'Videospielkonsole', um die negativen Assoziationen des Crashs zu umgehen. Der Trick funktionierte: Bis 1990 stand ein NES in jedem dritten amerikanischen Haushalt."
      ],
    },
    facts: {
      unitsSold: "61,91 Millionen",
      cpu: "Ricoh 2A03 (1,79 MHz)",
      gameLibrary: { en: "716 official games", de: "716 offizielle Spiele" },
      launchPrice: "14.800 Yen / $179 (1985)",
    },
    milestones: [
      { title: "Super Mario Bros.", year: 1985, description: { en: "Defined the platformer genre and became the best-selling game of its era", de: "Definierte das Jump'n'Run-Genre und wurde zum meistverkauften Spiel seiner Zeit" } },
      { title: "The Legend of Zelda", year: 1986, description: { en: "Invented the action-adventure genre with an open world and battery-backed saves", de: "Erfand das Action-Adventure-Genre mit offener Welt und Battery-Save" } },
      { title: "Metroid", year: 1986, description: { en: "Pioneer of non-linear exploration — Samus Aran was one of the first female protagonists in gaming", de: "Pionierin der nicht-linearen Exploration — Samus Aran war eine der ersten weiblichen Protagonistinnen" } },
      { title: "Mega Man 2", year: 1988, description: { en: "Perfected the boss-rush formula and became synonymous with challenging level design", de: "Perfektionierte die Boss-Rush-Formel und wurde zum Synonym für forderndes Leveldesign" } },
      { title: "Final Fantasy", year: 1987, description: { en: "Saved Square from bankruptcy and founded one of the greatest RPG franchises", de: "Rettete Square vor dem Bankrott und begründete eine der größten RPG-Serien" } },
    ],
  },
  {
    platformId: "snes",
    manufacturer: "Nintendo",
    releaseYear: 1990,
    alternateNames: ["Super Famicom (Japan)", "Super NES", "SNES"],
    history: {
      en: [
        "The Super Nintendo launched in 1990 in Japan as the successor to the enormously successful Famicom. With its 16-bit processor, the revolutionary Mode 7 graphics chip for rotation and scaling effects, and an outstanding sound chip made by Sony (yes, Sony!), it set new standards. That sound chip was designed by Ken Kutaragi, incidentally — the man who would later create the PlayStation.",
        "The rivalry between Nintendo and Sega defined the early 1990s. 'Sega does what Nintendon't' was Sega's aggressive advertising campaign. But while the Mega Drive/Genesis temporarily led in North America, Nintendo won the war of software quality: Super Mario World, A Link to the Past, Super Metroid, and Chrono Trigger remain among the greatest games of all time to this day.",
        "The SNES was also home to a golden age of Japanese RPGs. Square released Final Fantasy IV, V, and VI, Chrono Trigger, and Secret of Mana — all masterpieces that shaped the genre forever. Enix countered with Dragon Quest V and VI. This creative golden era remains unmatched to this day."
      ],
      de: [
        "Das Super Nintendo erschien 1990 in Japan als Nachfolger des überaus erfolgreichen Famicom. Mit dem 16-Bit-Prozessor, dem revolutionären Mode-7-Grafikchip für Rotations- und Skalierungseffekte und einem herausragenden Soundchip von Sony (ja, Sony!) setzte es neue Maßstäbe. Der Soundchip wurde übrigens von Ken Kutaragi entwickelt — dem Mann, der später die PlayStation erschaffen sollte.",
        "Die Rivalität zwischen Nintendo und Sega prägte die frühen 90er Jahre. 'Sega does what Nintendon't' lautete Segas aggressive Werbekampagne. Doch während der Mega Drive/Genesis in Nordamerika zeitweise führte, gewann Nintendo den Krieg der Softwarequalität: Super Mario World, A Link to the Past, Super Metroid und Chrono Trigger zählen bis heute zu den besten Spielen aller Zeiten.",
        "Das SNES war auch die Heimat einer goldenen Ära der japanischen RPGs. Square veröffentlichte Final Fantasy IV, V und VI, Chrono Trigger und Secret of Mana — allesamt Meisterwerke, die das Genre für immer prägten. Enix konterte mit Dragon Quest V und VI. Diese kreative Blütezeit ist bis heute unerreicht."
      ],
    },
    facts: {
      unitsSold: "49,10 Millionen",
      cpu: "Ricoh 5A22 (3,58 MHz)",
      gameLibrary: { en: "1,757 official games", de: "1.757 offizielle Spiele" },
      launchPrice: "25.000 Yen / $199 (1991)",
    },
    milestones: [
      { title: "Super Mario World", year: 1990, description: { en: "Launch title and one of the most perfect platformers ever made — introduced Yoshi", de: "Launch-Titel und eines der perfektesten Jump'n'Runs aller Zeiten — führte Yoshi ein" } },
      { title: "The Legend of Zelda: A Link to the Past", year: 1991, description: { en: "Defined the Zelda formula with the Light/Dark World concept and dungeon design", de: "Definierte die Zelda-Formel mit Licht-/Schattenwelt und Dungeon-Design" } },
      { title: "Super Metroid", year: 1994, description: { en: "Widely regarded as one of the best-designed games ever — a master class in atmosphere", de: "Gilt als eines der bestdesignten Spiele überhaupt — Meister der Atmosphäre" } },
      { title: "Chrono Trigger", year: 1995, description: { en: "A dream team of Square, Akira Toriyama, and Yuji Horii created a timeless RPG masterpiece", de: "Dream-Team aus Square, Akira Toriyama und Yuji Horii schuf ein zeitloses RPG-Meisterwerk" } },
      { title: "Donkey Kong Country", year: 1994, description: { en: "Rare's pre-rendered 3D graphics were technically groundbreaking and saved the SNES from the 32-bit onslaught", de: "Rares vorgerendertes 3D-Grafik war technisch bahnbrechend und rettete das SNES vor dem 32-Bit-Ansturm" } },
    ],
  },
  {
    platformId: "n64",
    manufacturer: "Nintendo",
    releaseYear: 1996,
    alternateNames: ["Nintendo 64", "N64", "Ultra 64", "Project Reality"],
    history: {
      en: [
        "The Nintendo 64 was a technical powerhouse ahead of its time — yet it made one fateful decision. While Sony and Sega embraced CD-ROMs, Nintendo stuck with cartridges. The advantages were fast load times and durability, but the disadvantages weighed heavier: cartridges were more expensive to produce, offered less storage space, and drove away third-party developers like Square, who defected to Sony.",
        "Nevertheless, Nintendo delivered some of the most influential games in video game history. Super Mario 64 defined how 3D games work — the analog controls with the revolutionary analog stick set the standard for all subsequent 3D titles. The Legend of Zelda: Ocarina of Time is still considered one of the greatest games of all time. GoldenEye 007 proved that first-person shooters could work on consoles.",
        "The N64 was also the console that defined multiplayer evenings like no other. Four controller ports were included as standard — a first for the industry. Mario Kart 64, Super Smash Bros., and Mario Party became the ultimate party games, creating memories that shaped an entire generation."
      ],
      de: [
        "Das Nintendo 64 war ein technisches Kraftpaket, das seiner Zeit voraus war — und gleichzeitig eine folgenschwere Fehlentscheidung traf. Während Sony und Sega auf CD-ROMs setzten, blieb Nintendo bei Modulen (Cartridges). Die Vorteile waren schnelle Ladezeiten und Robustheit, doch die Nachteile wogen schwerer: Module waren teurer in der Produktion, boten weniger Speicherplatz und vergraulten Drittanbieter wie Square, die zu Sony wechselten.",
        "Trotzdem lieferte Nintendo einige der einflussreichsten Spiele der Videospielgeschichte. Super Mario 64 definierte, wie 3D-Spiele funktionieren — die analoge Steuerung mit dem revolutionären Analog-Stick setzte den Standard für alle nachfolgenden 3D-Titel. The Legend of Zelda: Ocarina of Time gilt bis heute als eines der besten Spiele aller Zeiten. GoldenEye 007 bewies, dass Ego-Shooter auch auf Konsolen funktionieren können.",
        "Der N64 war auch die Konsole, die Mehrspieler-Abende prägte wie keine andere. Vier Controller-Anschlüsse waren serienmäßig verbaut — ein Novum. Mario Kart 64, Super Smash Bros. und Mario Party wurden zu den ultimativen Partyspielen und schufen Erinnerungen, die eine ganze Generation prägte."
      ],
    },
    facts: {
      unitsSold: "32,93 Millionen",
      cpu: "NEC VR4300 (93,75 MHz)",
      gameLibrary: { en: "388 official games", de: "388 offizielle Spiele" },
      launchPrice: "25.000 Yen / $199,99 (1996)",
    },
    milestones: [
      { title: "Super Mario 64", year: 1996, description: { en: "Revolutionized 3D gaming and defined analog controls for all generations to come", de: "Revolutionierte 3D-Gaming und definierte die analoge Steuerung für alle kommenden Generationen" } },
      { title: "The Legend of Zelda: Ocarina of Time", year: 1998, description: { en: "Regarded as one of the most influential games of all time — introduced Z-Targeting", de: "Gilt als eines der einflussreichsten Spiele aller Zeiten — führte Z-Targeting ein" } },
      { title: "GoldenEye 007", year: 1997, description: { en: "Proved that first-person shooters work on consoles and defined splitscreen multiplayer", de: "Bewies, dass Ego-Shooter auf Konsolen funktionieren und definierte den Splitscreen-Multiplayer" } },
      { title: "Super Smash Bros.", year: 1999, description: { en: "Founded the crossover fighting game genre with Nintendo characters", de: "Begründete das Crossover-Kampfspiel-Genre mit Nintendo-Charakteren" } },
      { title: "The Legend of Zelda: Majora's Mask", year: 2000, description: { en: "Innovative three-day time loop system and the darkest Zelda story ever told", de: "Innovatives Drei-Tages-Zeitschleifen-System und die dunkelste Zelda-Geschichte" } },
    ],
  },
  {
    platformId: "gc",
    manufacturer: "Nintendo",
    releaseYear: 2001,
    alternateNames: ["GameCube", "NGC", "DOL-001"],
    history: {
      en: [
        "The GameCube was Nintendo's first step away from cartridges toward optical media — though not standard DVDs, but proprietary mini-discs. This decision prevented DVD playback and frustrated third-party developers who had to split their games across multiple discs. In a generation dominated by the PlayStation 2, the GameCube faced an uphill battle.",
        "What the GameCube lacked in market share, it made up for in game quality. Metroid Prime proved that the Metroid formula could work in first-person perspective. The Wind Waker dared to adopt a bold cel-shading art style that was initially criticized but later celebrated as timeless. Resident Evil 4, originally planned as a GameCube exclusive, is considered one of the most influential action titles ever made.",
        "The GameCube also introduced the GBA Link Cable port, which enabled innovative gameplay possibilities — such as in The Legend of Zelda: Four Swords Adventures or Final Fantasy Crystal Chronicles. Though commercially behind the PS2 and Xbox, the GameCube enjoys cult status today and its games command high collector prices."
      ],
      de: [
        "Der GameCube war Nintendos erster Schritt weg von Modulen hin zu optischen Datenträgern — allerdings nicht zu Standard-DVDs, sondern zu proprietären Mini-Discs. Diese Entscheidung verhinderte DVD-Wiedergabe und ärgerte Drittanbieter, die ihre Spiele auf mehrere Discs aufteilen mussten. In einer Generation, die von der PlayStation 2 dominiert wurde, hatte es der GameCube schwer.",
        "Was dem GameCube an Marktanteil fehlte, machte er mit Spielequalität wett. Metroid Prime bewies, dass die Metroid-Formel auch in der Ego-Perspektive funktioniert. The Wind Waker wagte einen mutigen Cel-Shading-Kunststil, der anfangs kritisiert, aber später als zeitlos gefeiert wurde. Resident Evil 4, ursprünglich als GameCube-Exklusivtitel geplant, gilt als einer der einflussreichsten Action-Titel überhaupt.",
        "Der GameCube führte auch den GBA-Link-Kabel-Anschluss ein, der innovative Gameplay-Möglichkeiten bot — etwa in The Legend of Zelda: Four Swords Adventures oder Final Fantasy Crystal Chronicles. Obwohl kommerziell hinter PS2 und Xbox zurück, genießt der GameCube heute Kultstatus und seine Spiele erzielen hohe Sammlerpreise."
      ],
    },
    facts: {
      unitsSold: "21,74 Millionen",
      cpu: "IBM Gekko (485 MHz)",
      gameLibrary: { en: "653 official games", de: "653 offizielle Spiele" },
      launchPrice: "25.000 Yen / $199,99 (2001)",
    },
    milestones: [
      { title: "Super Smash Bros. Melee", year: 2001, description: { en: "Best-selling GameCube game, still actively played in the competitive fighting game scene today", de: "Meistverkauftes GameCube-Spiel und bis heute aktiv in der kompetitiven Fighting-Game-Szene" } },
      { title: "Metroid Prime", year: 2002, description: { en: "Masterful genre shift from 2D to first-person — a milestone in game design", de: "Meisterhafter Genrewechsel von 2D zu First-Person — ein Meilenstein des Gamedesigns" } },
      { title: "The Legend of Zelda: The Wind Waker", year: 2002, description: { en: "Bold cel-shading style that initially polarized audiences, now regarded as a timeless classic", de: "Mutiger Cel-Shading-Stil, der anfangs polarisierte, heute als zeitloser Klassiker gilt" } },
      { title: "Resident Evil 4", year: 2005, description: { en: "Revolutionized the action genre with the over-the-shoulder camera perspective", de: "Revolutionierte das Action-Genre mit der Über-die-Schulter-Kamera" } },
      { title: "Paper Mario: Die Legende vom Äonentor", year: 2004, description: { en: "One of the most charming RPGs of its generation with a unique paper art style", de: "Eines der charmantesten RPGs der Generation mit einzigartigem Papier-Kunststil" } },
    ],
  },
  {
    platformId: "wii",
    manufacturer: "Nintendo",
    releaseYear: 2006,
    alternateNames: ["Nintendo Wii", "Revolution (Codename)"],
    history: {
      en: [
        "The Wii was Nintendo's boldest experiment — and their greatest commercial success in console history. Instead of entering a performance arms race with Sony and Microsoft, Nintendo bet on motion controls. The Wii Remote controller with its accelerometer and infrared pointer made video games accessible to everyone: grandparents bowled, families played tennis, and fitness enthusiasts trained with Wii Fit.",
        "Wii Sports, bundled with the console in most regions, became a cultural phenomenon. It was the game that got non-gamers to play. Retirement homes organized Wii bowling tournaments, physiotherapists used the console in rehabilitation. The Wii no longer just stood in the kids' room — it stood in the living room, the community center, the office.",
        "Despite its weak hardware (essentially a slightly souped-up GameCube), the Wii sold over 101 million units. However, it lost momentum toward the end of its lifecycle — hardcore gamers felt neglected, and the stream of casual games dried up. Still, the Wii proved that innovation matters more than raw processing power."
      ],
      de: [
        "Die Wii war Nintendos kühntes Experiment — und ihr größter kommerzieller Erfolg in der Konsolengeschichte. Statt sich auf einen Leistungswettlauf mit Sony und Microsoft einzulassen, setzte Nintendo auf Bewegungssteuerung. Der Wii Remote Controller mit seinem Beschleunigungssensor und Infrarot-Zeiger machte Videospiele für alle zugänglich: Großeltern bowlten, Familien spielten Tennis, und Fitnessbegeisterte trainierten mit Wii Fit.",
        "Wii Sports, das in den meisten Regionen als Bundlespiel beilag, wurde zum Kulturphänomen. Es war das Spiel, das Nicht-Spieler zum Spielen brachte. Altenheime richteten Wii-Bowling-Turniere ein, Physiotherapeuten setzten die Konsole in der Rehabilitation ein. Die Wii stand nicht mehr nur im Kinderzimmer — sie stand im Wohnzimmer, im Gemeinschaftsraum, im Büro.",
        "Trotz der schwachen Hardware (im Grunde ein leicht aufgebohrter GameCube) verkaufte sich die Wii über 101 Millionen Mal. Allerdings verlor sie gegen Ende ihres Lebenszyklus an Schwung — Hardcore-Gamer fühlten sich vernachlässigt, und der Strom an Casual-Spielen ließ nach. Dennoch bewies die Wii, dass Innovation wichtiger ist als rohe Rechenleistung."
      ],
    },
    facts: {
      unitsSold: "101,63 Millionen",
      cpu: "IBM Broadway (729 MHz)",
      gameLibrary: { en: "1,637 official games", de: "1.637 offizielle Spiele" },
      launchPrice: "25.000 Yen / $249,99 (2006)",
    },
    milestones: [
      { title: "Wii Sports", year: 2006, description: { en: "Best-selling single console game — made motion controls mainstream", de: "Meistverkauftes Einzelspiel einer Konsole — machte Bewegungssteuerung zum Mainstream" } },
      { title: "Super Mario Galaxy", year: 2007, description: { en: "Revolutionized 3D platformers with gravity mechanics and planetary level design", de: "Revolutionierte 3D-Plattformer mit Schwerkraft-Mechanik und planetarem Leveldesign" } },
      { title: "Wii Fit", year: 2007, description: { en: "Fitness game with Balance Board sold over 22 million units worldwide", de: "Fitness-Spiel mit Balance Board verkaufte über 22 Millionen Einheiten weltweit" } },
      { title: "The Legend of Zelda: Skyward Sword", year: 2011, description: { en: "First Zelda with precise 1:1 motion controls thanks to Wii MotionPlus", de: "Erstes Zelda mit präziser 1:1-Bewegungssteuerung dank Wii MotionPlus" } },
      { title: "Super Smash Bros. Brawl", year: 2008, description: { en: "Introduced online multiplayer and expanded the roster with guest characters like Solid Snake", de: "Führte Online-Multiplayer ein und erweiterte den Roster um Gastcharaktere wie Solid Snake" } },
    ],
  },
  {
    platformId: "wiiu",
    manufacturer: "Nintendo",
    releaseYear: 2012,
    alternateNames: ["Wii U", "Project Cafe (Codename)"],
    history: {
      en: [
        "The Wii U was Nintendo's biggest commercial failure since the Virtual Boy. The core problem: hardly anyone understood the product. The tablet-like GamePad controller with its integrated screen was innovative, but the marketing failed to clearly communicate that it was a new console — many thought it was just a Wii accessory.",
        "Compounding the issue was a catastrophic software drought at launch and a lack of third-party support. The weak hardware couldn't compete with the PlayStation 4 or Xbox One, and the online infrastructure lagged behind the competition. Nintendo fought desperately to keep the platform relevant.",
        "Despite its commercial failure, the Wii U featured some of the best Nintendo games ever made. Super Mario 3D World, Splatoon, Bayonetta 2, and The Legend of Zelda: Breath of the Wild (which also launched on the Switch) demonstrated that Nintendo's game development remained world-class. Many Wii U titles were later ported to the Switch as 'Deluxe' editions, finally finding their audience there."
      ],
      de: [
        "Die Wii U war Nintendos größter kommerzieller Misserfolg seit dem Virtual Boy. Das Kernproblem: Kaum jemand verstand das Produkt. Der Tablet-ähnliche GamePad-Controller mit integriertem Bildschirm war innovativ, aber die Vermarktung scheiterte daran, klar zu kommunizieren, dass es sich um eine neue Konsole handelte — viele hielten ihn für ein Zubehör der Wii.",
        "Hinzu kam ein katastrophaler Softwaremangel zum Launch und fehlende Unterstützung durch Drittanbieter. Die schwache Hardware konnte nicht mit der PlayStation 4 oder Xbox One mithalten, und die Online-Infrastruktur blieb hinter der Konkurrenz zurück. Nintendo kämpfte verzweifelt darum, die Plattform relevant zu halten.",
        "Trotz des kommerziellen Misserfolgs bot die Wii U einige der besten Nintendo-Spiele überhaupt. Super Mario 3D World, Splatoon, Bayonetta 2 und The Legend of Zelda: Breath of the Wild (das auch auf der Switch erschien) zeigten, dass Nintendos Spieleentwicklung erstklassig blieb. Viele Wii-U-Titel wurden später als 'Deluxe'-Versionen auf die Switch portiert und fanden dort endlich ihr Publikum."
      ],
    },
    facts: {
      unitsSold: "13,56 Millionen",
      cpu: "IBM Espresso (1,24 GHz, Tri-Core)",
      gameLibrary: { en: "791 official games", de: "791 offizielle Spiele" },
      launchPrice: "26.250 Yen / $299,99 (2012)",
    },
    milestones: [
      { title: "Splatoon", year: 2015, description: { en: "Nintendo's first new IP in years — a fresh team shooter with a unique paint concept", de: "Nintendos erste neue IP seit Jahren — frischer Team-Shooter mit einzigartigem Farb-Konzept" } },
      { title: "Super Mario 3D World", year: 2013, description: { en: "Brilliant co-op platformer with the Cat power-up and creative level design", de: "Brillanter Koop-Plattformer mit dem Katzen-Powerup und kreativem Leveldesign" } },
      { title: "Mario Kart 8", year: 2014, description: { en: "Introduced anti-gravity tracks — the best-selling Wii U game", de: "Führte Antigravitations-Strecken ein — das meistverkaufte Wii-U-Spiel" } },
      { title: "Super Smash Bros. for Wii U", year: 2014, description: { en: "HD debut of the series with the largest fighter roster to date", de: "HD-Debüt der Serie mit dem bisher größten Kämpfer-Roster" } },
      { title: "Bayonetta 2", year: 2014, description: { en: "A Nintendo-funded action masterpiece that would never have existed without their support", de: "Von Nintendo finanziertes Action-Meisterwerk, das ohne ihre Unterstützung nie erschienen wäre" } },
    ],
  },
  {
    platformId: "switch",
    manufacturer: "Nintendo",
    releaseYear: 2017,
    alternateNames: ["Nintendo Switch", "NX (Codename)"],
    history: {
      en: [
        "The Nintendo Switch was Nintendo's answer to the Wii U debacle — and it was brilliantly simple. The idea: a console that works both docked on a TV and on the go as a handheld. This hybrid concept was the logical conclusion of Nintendo's history with home consoles and handhelds. Instead of serving two separate markets, they united them in one device.",
        "The March 2017 launch was accompanied by The Legend of Zelda: Breath of the Wild — a game that redefined the open-world formula and received universal acclaim. Super Mario Odyssey followed in October, proving that Nintendo could deliver two masterpieces in the same year. The Switch euphoria was boundless.",
        "The Switch also became home to a thriving indie scene. Games like Hollow Knight, Celeste, and Stardew Valley found their ideal home on the portable console. With over 140 million units sold, the Switch surpassed the Wii and the Game Boy to become one of the best-selling consoles of all time."
      ],
      de: [
        "Die Nintendo Switch war Nintendos Antwort auf den Wii-U-Misserfolg — und sie war brillant einfach. Die Idee: Eine Konsole, die sowohl stationär am Fernseher als auch unterwegs als Handheld funktioniert. Dieses Hybrid-Konzept war die logische Schlussfolgerung aus Nintendos Geschichte mit Heimkonsolen und Handhelds. Statt zwei separate Märkte zu bedienen, vereinte man sie in einem Gerät.",
        "Der Launch im März 2017 wurde von The Legend of Zelda: Breath of the Wild begleitet — einem Spiel, das die Open-World-Formel neu definierte und universelle Bestnoten erhielt. Super Mario Odyssey folgte im Oktober und bewies, dass Nintendo gleich zwei Meisterwerke im selben Jahr liefern konnte. Die Switch-Euphorie war grenzenlos.",
        "Die Switch wurde auch zur Heimat einer blühenden Indie-Szene. Spiele wie Hollow Knight, Celeste und Stardew Valley fanden auf der tragbaren Konsole ihr ideales Zuhause. Mit über 140 Millionen verkauften Einheiten überholte die Switch die Wii und den Game Boy und wurde zu einer der meistverkauften Konsolen aller Zeiten."
      ],
    },
    facts: {
      unitsSold: "143,42 Millionen (Stand 2024)",
      cpu: "NVIDIA Tegra X1 (1,02 GHz)",
      gameLibrary: { en: "5,000+ games", de: "5.000+ Spiele" },
      launchPrice: "29.980 Yen / $299,99 (2017)",
    },
    milestones: [
      { title: "The Legend of Zelda: Breath of the Wild", year: 2017, description: { en: "Revolutionized the open-world genre with complete freedom and physics-based gameplay", de: "Revolutionierte das Open-World-Genre mit vollständiger Freiheit und physikbasiertem Gameplay" } },
      { title: "Super Mario Odyssey", year: 2017, description: { en: "Celebrated the entire Mario legacy with the ingenious Cappy transformation mechanic", de: "Feierte die gesamte Mario-Geschichte mit der genialen Cappy-Verwandlungsmechanik" } },
      { title: "Animal Crossing: New Horizons", year: 2020, description: { en: "Became a global social gathering place during the COVID pandemic", de: "Wurde während der COVID-Pandemie zum globalen sozialen Treffpunkt" } },
      { title: "Splatoon 3", year: 2022, description: { en: "Over 3.45 million units on launch weekend in Japan alone", de: "Über 3,45 Millionen Einheiten am ersten Wochenende allein in Japan" } },
      { title: "The Legend of Zelda: Tears of the Kingdom", year: 2023, description: { en: "Built on BotW with the Ultrahand system, letting players build virtually anything", de: "Baute mit dem Ultrahand-System auf BotW auf und ließ Spieler nahezu alles bauen" } },
    ],
  },
  // ── Sega ──
  {
    platformId: "sg1000",
    manufacturer: "Sega",
    releaseYear: 1983,
    alternateNames: ["SG-1000", "Sega Game 1000"],
    history: {
      en: [
        "The SG-1000 was Sega's very first home console, launching on the exact same day as Nintendo's Famicom — July 15, 1983. This coincidence would mark the beginning of a rivalry that lasted decades. Sega, originally a company focused on arcade machines, took a bold step into the home console market with the SG-1000.",
        "Technically, the SG-1000 was inferior to the Famicom and couldn't compete in the Japanese market. Its game library consisted mainly of arcade ports like Congo Bongo and Star Jacker. Nevertheless, the SG-1000 laid the foundation for Sega's console business and led to the improved SG-1000 II in 1984.",
        "Outside Japan, the SG-1000 was barely available, though it was sold in some Asian countries and Australia as a licensed version. Its true significance lies in giving Sega its entry into the console market — without the SG-1000, there would have been no Master System and no Mega Drive."
      ],
      de: [
        "Der SG-1000 war Segas allererste Heimkonsole und erschien am selben Tag wie Nintendos Famicom — dem 15. Juli 1983. Dieser Zufall sollte den Beginn einer jahrzehntelangen Rivalität markieren. Sega, ursprünglich ein Unternehmen für Arcade-Automaten, wagte mit dem SG-1000 den Schritt in den Heimkonsolenmarkt.",
        "Technisch war der SG-1000 dem Famicom unterlegen und konnte im japanischen Markt nicht mithalten. Die Spielebibliothek bestand größtenteils aus Arcade-Portierungen wie Congo Bongo und Star Jacker. Trotzdem legte der SG-1000 den Grundstein für Segas Konsolengeschäft und führte 1984 zur verbesserten Version SG-1000 II.",
        "Außerhalb Japans war der SG-1000 kaum erhältlich, wurde aber in einigen asiatischen Ländern und Australien (als Lizenzversion) verkauft. Seine wahre Bedeutung liegt darin, dass er Sega den Einstieg in den Konsolenmarkt ermöglichte — ohne den SG-1000 hätte es kein Master System und keinen Mega Drive gegeben."
      ],
    },
    facts: {
      unitsSold: "Geschätzt 2 Millionen (inkl. Varianten)",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: { en: "74 official games", de: "74 offizielle Spiele" },
      launchPrice: "15.000 Yen (1983)",
    },
    milestones: [
      { title: "Congo Bongo", year: 1983, description: { en: "Isometric arcade port that showcased the hardware's capabilities", de: "Isometrischer Arcade-Port, der die Fähigkeiten der Hardware demonstrierte" } },
      { title: "Girl's Garden", year: 1984, description: { en: "One of the first games by Yuji Naka — the future creator of Sonic the Hedgehog", de: "Eines der ersten Spiele von Yuji Naka — dem späteren Schöpfer von Sonic the Hedgehog" } },
      { title: "SG-1000 II", year: 1984, description: { en: "Revised version with detachable controller and improved design", de: "Überarbeitete Version mit abnehmbarem Controller und besserem Design" } },
    ],
  },
  {
    platformId: "mastersystem",
    manufacturer: "Sega",
    releaseYear: 1985,
    alternateNames: ["Sega Master System", "Mark III (Japan)", "SMS"],
    history: {
      en: [
        "The Sega Master System was Sega's second attempt at the home console market and was technically superior to the NES in many areas — more colors, better sound, and more powerful hardware. Yet in Japan and North America, it couldn't break Nintendo's stranglehold on the market. Nintendo's restrictive licensing agreements prevented many third-party developers from creating games for the competition.",
        "While the Master System flopped in Japan and the US, it became an overwhelming success in Europe and Brazil. In Brazil, where Nintendo had no official distribution, the Master System dominated the market almost completely. The Brazilian company Tec Toy continues to produce variants of the Master System to this day — making it the longest continuously produced game console in the world.",
        "The Master System offered some outstanding games, including Phantasy Star — one of the first RPGs with first-person dungeon exploration and a female protagonist. Alex Kidd, Sega's original mascot before Sonic, had his origins here. Wonder Boy, Shinobi, and Fantasy Zone rounded out a solid library."
      ],
      de: [
        "Das Sega Master System war Segas zweiter Versuch im Heimkonsolenmarkt und technisch dem NES in vielen Bereichen überlegen — mehr Farben, besserer Sound, leistungsfähigere Hardware. Doch in Japan und Nordamerika konnte es Nintendos Würgegriff auf den Markt nicht brechen. Nintendos restriktive Lizenzverträge verhinderten, dass viele Drittanbieter Spiele für die Konkurrenz entwickelten.",
        "Während das Master System in Japan und den USA floppte, wurde es in Europa und Brasilien zum überragenden Erfolg. In Brasilien, wo Nintendo keinen offiziellen Vertrieb hatte, dominierte das Master System den Markt fast vollständig. Die brasilianische Firma Tec Toy produziert bis heute Varianten des Master Systems — es ist die am längsten kontinuierlich produzierte Spielkonsole der Welt.",
        "Das Master System bot einige herausragende Spiele, darunter Phantasy Star — eines der ersten RPGs mit Ego-Perspektive in Dungeons und einer weiblichen Hauptfigur. Alex Kidd, Segas ursprüngliches Maskottchen vor Sonic, hatte hier seinen Ursprung. Wonder Boy, Shinobi und Fantasy Zone rundeten eine solide Bibliothek ab."
      ],
    },
    facts: {
      unitsSold: "13 Millionen (geschätzt)",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: { en: "318 official games", de: "318 offizielle Spiele" },
      launchPrice: "20.000 Yen / $200 (1986)",
    },
    milestones: [
      { title: "Phantasy Star", year: 1987, description: { en: "Groundbreaking RPG with a female protagonist and 3D dungeons — Sega's answer to Final Fantasy", de: "Bahnbrechendes RPG mit weiblicher Protagonistin und 3D-Dungeons — Segas Antwort auf Final Fantasy" } },
      { title: "Alex Kidd in Miracle World", year: 1986, description: { en: "Sega's first mascot game — built into the system in many regions", de: "Segas erstes Maskottchen-Spiel — in vielen Regionen ins System integriert" } },
      { title: "Wonder Boy III: The Dragon's Trap", year: 1989, description: { en: "Innovative action RPG with transformation mechanics — returned as a remake in 2017", de: "Innovatives Action-RPG mit Verwandlungsmechanik — 2017 als Remake zurückgekehrt" } },
      { title: "Sonic the Hedgehog (SMS)", year: 1991, description: { en: "Standalone 8-bit version that pushed the Master System's technical limits", de: "Eigenständige 8-Bit-Version, die die technischen Grenzen des Master Systems ausreizte" } },
    ],
  },
  {
    platformId: "megadrive",
    manufacturer: "Sega",
    releaseYear: 1988,
    alternateNames: ["Mega Drive (Japan/Europa)", "Genesis (Nordamerika)"],
    history: {
      en: [
        "The Sega Mega Drive was the console that finally let Sega go toe-to-toe with Nintendo. Marketed as the 'Genesis' in North America, Sega deployed aggressive advertising with the legendary slogan 'Genesis does what Nintendon't'. The 16-bit console launched two years before the Super Nintendo and skillfully exploited that head start.",
        "The decisive moment came in 1991 with Sonic the Hedgehog. The blue hedgehog became Sega's mascot and the embodiment of speed and coolness — a deliberate contrast to Nintendo's family-friendly Mario. Sonic 2 sold over six million units on its launch day, dubbed 'Sonic 2sday' (a Tuesday), making it the most successful product launch in video game history up to that point.",
        "The Mega Drive was also home to Sega's outstanding arcade ports. Streets of Rage, Golden Axe, Altered Beast, and Virtua Fighter 2 — Sega brought the arcade experience into living rooms like no one else. The console also boasted a strong sports game library thanks to EA and a vibrant RPG scene with the Shining Force and Phantasy Star series."
      ],
      de: [
        "Der Sega Mega Drive war die Konsole, mit der Sega endlich Nintendo die Stirn bot. In Nordamerika als 'Genesis' vermarktet, setzte Sega auf aggressive Werbung mit dem legendären Slogan 'Genesis does what Nintendon't'. Die 16-Bit-Konsole erschien zwei Jahre vor dem Super Nintendo und nutzte diesen Vorsprung geschickt aus.",
        "Der entscheidende Moment kam 1991 mit Sonic the Hedgehog. Der blaue Igel wurde zu Segas Maskottchen und zum Inbegriff von Geschwindigkeit und Coolness — ein bewusster Kontrast zu Nintendos familienfreundlichem Mario. Sonic 2 verkaufte am Erscheinungstag, dem 'Sonic 2sday' (einem Dienstag), über sechs Millionen Einheiten und war die erfolgreichste Produkteinführung der Videospielgeschichte bis zu diesem Zeitpunkt.",
        "Der Mega Drive war auch die Heimat von Segas herausragenden Arcade-Portierungen. Streets of Rage, Golden Axe, Altered Beast und Virtua Fighter 2 — Sega brachte das Arcade-Erlebnis ins Wohnzimmer wie kein anderer. Die Konsole hatte außerdem eine starke Sport-Spiele-Bibliothek dank EA und eine lebendige RPG-Szene mit den Shining-Force- und Phantasy-Star-Serien."
      ],
    },
    facts: {
      unitsSold: "30,75 Millionen",
      cpu: "Motorola 68000 (7,67 MHz)",
      gameLibrary: { en: "915 official games", de: "915 offizielle Spiele" },
      launchPrice: "21.000 Yen / $189,99 (1989)",
    },
    milestones: [
      { title: "Sonic the Hedgehog", year: 1991, description: { en: "Sega's answer to Mario — defined the Sega brand and sold 15 million units", de: "Segas Antwort auf Mario — definierte die Marke Sega und verkaufte 15 Millionen Einheiten" } },
      { title: "Streets of Rage 2", year: 1992, description: { en: "One of the greatest beat 'em ups of all time with a legendary soundtrack by Yuzo Koshiro", de: "Einer der besten Beat'em'ups aller Zeiten mit legendärem Soundtrack von Yuzo Koshiro" } },
      { title: "Gunstar Heroes", year: 1993, description: { en: "Treasure's debut — a technical marvel with non-stop action and co-op", de: "Treasures Debüt — ein technisches Wunderwerk mit Non-Stop-Action und Co-Op" } },
      { title: "Phantasy Star IV", year: 1993, description: { en: "Crowning achievement of the series with manga cutscenes and one of the best RPG combat systems of the era", de: "Krönung der Serie mit Manga-Cutscenes und einem der besten RPG-Kampfsysteme der Ära" } },
      { title: "Sonic the Hedgehog 2", year: 1992, description: { en: "Introduced Tails and the Spin Dash — the 'Sonic 2sday' launch was a marketing milestone", de: "Führte Tails und den Spin Dash ein — der 'Sonic 2sday'-Launch war ein Marketing-Meilenstein" } },
    ],
  },
  {
    platformId: "segacd",
    manufacturer: "Sega",
    releaseYear: 1991,
    alternateNames: ["Sega CD (Nordamerika)", "Mega-CD (Japan/Europa)"],
    history: {
      en: [
        "The Sega CD was Sega's attempt to upgrade the Mega Drive with CD-ROM technology. The additional hardware offered more storage space, scaling and rotation effects, and the ability to play CD audio and full-motion video (FMV). Sega promised a revolution — but reality was sobering.",
        "Instead of using the extra power for better gameplay, developers flooded the market with cheap FMV games. Night Trap, Ground Zero Texas, and similar titles consisted of poorly filmed videos with minimal interaction. This FMV glut severely damaged the Sega CD's image. Night Trap also triggered a political controversy that directly led to the creation of the ESRB age rating system.",
        "Nevertheless, there were gems: Sonic CD is considered one of the best Sonic games ever, featuring an innovative time travel concept. Lunar: The Silver Star and Lunar: Eternal Blue from Game Arts were outstanding RPGs. Snatcher by Hideo Kojima offered a gripping cyberpunk narrative. However, these titles couldn't prevent the Sega CD's commercial failure."
      ],
      de: [
        "Das Sega CD war Segas Versuch, den Mega Drive mit CD-ROM-Technologie aufzurüsten. Die zusätzliche Hardware bot mehr Speicherplatz, Skalierungs- und Rotationseffekte und die Möglichkeit, CD-Audio und Full-Motion-Video (FMV) abzuspielen. Sega versprach eine Revolution — doch die Realität war ernüchternd.",
        "Statt die zusätzliche Leistung für besseres Gameplay zu nutzen, überfluteten Entwickler den Markt mit billigen FMV-Spielen. Night Trap, Ground Zero Texas und ähnliche Titel bestanden aus schlecht gefilmten Videos mit minimaler Interaktion. Diese FMV-Schwemme schadete dem Image des Sega CD erheblich. Night Trap löste zudem eine politische Kontroverse aus, die direkt zur Gründung des ESRB-Altersfreigabesystems führte.",
        "Trotzdem gab es Perlen: Sonic CD gilt als eines der besten Sonic-Spiele überhaupt, mit dem innovativen Zeitreise-Konzept. Lunar: The Silver Star und Lunar: Eternal Blue von Game Arts waren herausragende RPGs. Snatcher von Hideo Kojima bot eine fesselnde Cyberpunk-Geschichte. Diese Titel konnten den kommerziellen Misserfolg des Sega CD jedoch nicht verhindern."
      ],
    },
    facts: {
      unitsSold: "2,24 Millionen",
      cpu: "Motorola 68000 (12,5 MHz, zusätzlich zum Mega Drive)",
      gameLibrary: { en: "210 official games", de: "210 offizielle Spiele" },
      launchPrice: "49.800 Yen / $299 (1992)",
    },
    milestones: [
      { title: "Sonic CD", year: 1993, description: { en: "Innovative time travel concept with past/future zones and a legendary soundtrack", de: "Innovatives Zeitreise-Konzept mit Past/Future-Zonen und legendärem Soundtrack" } },
      { title: "Lunar: The Silver Star", year: 1992, description: { en: "One of the best RPGs of the 16-bit era with beautiful anime cutscenes", de: "Eines der besten RPGs der 16-Bit-Ära mit wunderschönen Anime-Cutscenes" } },
      { title: "Snatcher", year: 1994, description: { en: "Hideo Kojima's cyberpunk adventure — a narrative masterpiece", de: "Hideo Kojimas Cyberpunk-Adventure — ein narratives Meisterwerk" } },
      { title: "Night Trap", year: 1992, description: { en: "Notorious FMV game that became a symbol of the video game censorship debate", de: "Berüchtigtes FMV-Spiel, das zum Symbol der Videospiel-Zensur-Debatte wurde" } },
    ],
  },
  {
    platformId: "sega32x",
    manufacturer: "Sega",
    releaseYear: 1994,
    alternateNames: ["Sega 32X", "Super 32X (Japan)", "Sega Mars (Codename)"],
    history: {
      en: [
        "The Sega 32X was a prime example of Sega's chaotic hardware strategy in the mid-1990s. It was an expansion adapter that plugged onto the Mega Drive, adding 32-bit capabilities. The problem: by the time it launched in 1994, the Sega Saturn had already been announced — why would consumers invest in a stopgap solution?",
        "The answer was: they didn't. The 32X sold catastrophically poorly. Only 40 games were released, and most were disappointing ports. Even Sega's own teams didn't know what to develop for — 32X or Saturn? This internal confusion led to a fragmentation of resources that seriously hurt Sega in the long run.",
        "The 32X is considered one of the greatest failures in video game history and a cautionary tale against rushed hardware cycles. There were a few decent titles like Knuckles' Chaotix and the Doom port, but the overall package convinced no one. The 'Tower of Power' — a Mega Drive stacked with Sega CD and 32X — became a symbol of Sega's missteps."
      ],
      de: [
        "Das Sega 32X war ein Paradebeispiel für Segas chaotische Hardwarestrategie Mitte der 90er Jahre. Es war ein Erweiterungsadapter, der auf den Mega Drive aufgesteckt wurde und 32-Bit-Fähigkeiten hinzufügte. Das Problem: Als es 1994 erschien, war der Sega Saturn bereits angekündigt — warum sollten Konsumenten in eine Übergangslösung investieren?",
        "Die Antwort lautete: Das taten sie nicht. Das 32X verkaufte sich katastrophal schlecht. Nur 40 Spiele erschienen, und die meisten waren enttäuschende Ports. Sogar Segas eigene Teams wussten nicht, wofür sie entwickeln sollten — 32X oder Saturn? Diese interne Verwirrung führte zu einer Fragmentierung der Ressourcen, die Sega langfristig schwer schadete.",
        "Das 32X gilt heute als eines der größten Misserfolge der Videospielgeschichte und als Warnung vor übereilten Hardware-Zyklen. Es gab einige wenige gelungene Titel wie Knuckles' Chaotix und die Portierung von Doom, aber das Gesamtpaket überzeugte niemanden. Die 'Tower of Power' — Mega Drive mit Sega CD und 32X gestapelt — wurde zum Symbol für Segas Fehlentscheidungen."
      ],
    },
    facts: {
      unitsSold: "665.000",
      cpu: "2x Hitachi SH2 (23 MHz)",
      gameLibrary: { en: "40 official games", de: "40 offizielle Spiele" },
      launchPrice: "16.800 Yen / $159,99 (1994)",
    },
    milestones: [
      { title: "Knuckles' Chaotix", year: 1995, description: { en: "The only Sonic universe game for the 32X, featuring an innovative rubber band co-op mechanic", de: "Einziges Sonic-Universum-Spiel für 32X mit innovativer Gummiband-Koop-Mechanik" } },
      { title: "Doom (32X)", year: 1994, description: { en: "Impressive port of id Software's classic — the highlight of the platform", de: "Beeindruckende Portierung von id Softwares Klassiker — das Highlight der Plattform" } },
      { title: "Star Wars Arcade", year: 1994, description: { en: "3D space battles that demonstrated the 32X's technical capabilities", de: "3D-Weltraumkämpfe, die die technischen Möglichkeiten des 32X demonstrierten" } },
    ],
  },
  {
    platformId: "saturn",
    manufacturer: "Sega",
    releaseYear: 1994,
    alternateNames: ["Sega Saturn"],
    history: {
      en: [
        "The Sega Saturn was technically fascinating — with its eight processors and dual-CPU architecture, it was one of the most complex consoles of its time. In Japan it was a massive hit, especially thanks to Virtua Fighter and strong arcade ports. The problem lay in North America: the surprise early release ('Surprise Launch') angered retailers and developers alike.",
        "Sega's decision to rush the Saturn to market four months ahead of schedule was a strategic disaster. Retailers who hadn't been informed delisted Sega products in protest. Developers didn't have time to finish launch titles. And just hours later, Sony announced the PlayStation for $100 less — a devastating blow.",
        "Despite its commercial failure in the West, the Saturn boasts one of the best 2D game libraries of all time. Japanese titles like Radiant Silvergun, Guardian Heroes, Panzer Dragoon Saga, and the Street Fighter ports are legendary. In Japan, the Saturn was far more successful thanks to Sega's arcade dominance and held on until 2000."
      ],
      de: [
        "Der Sega Saturn war technisch faszinierend — mit seinen acht Prozessoren und der Dual-CPU-Architektur war er eine der komplexesten Konsolen seiner Zeit. In Japan war er ein Riesenerfolg, vor allem dank Virtua Fighter und der starken Arcade-Portierungen. Das Problem lag in Nordamerika: Die überraschende Vorveröffentlichung zum Launch ('Surprise Launch') verärgerte Händler und Entwickler gleichermaßen.",
        "Segas Entscheidung, den Saturn vier Monate vor dem geplanten Termin auf den Markt zu werfen, war ein strategisches Desaster. Händler, die nicht informiert worden waren, listeten Sega-Produkte aus Protest aus. Entwickler hatten keine Zeit, Launch-Titel fertigzustellen. Und nur Stunden später kündigte Sony die PlayStation für $100 weniger an — ein vernichtender Schlag.",
        "Trotz des kommerziellen Misserfolgs im Westen besitzt der Saturn eine der besten 2D-Spielebibliotheken aller Zeiten. Japanische Titel wie Radiant Silvergun, Guardian Heroes, Panzer Dragoon Saga und die Street-Fighter-Portierungen sind legendär. In Japan war der Saturn dank Segas Arcade-Dominanz weitaus erfolgreicher und hielt sich bis 2000."
      ],
    },
    facts: {
      unitsSold: "9,26 Millionen",
      cpu: "2x Hitachi SH2 (28,6 MHz)",
      gameLibrary: { en: "1,094 official games", de: "1.094 offizielle Spiele" },
      launchPrice: "44.800 Yen / $399 (1995)",
    },
    milestones: [
      { title: "Virtua Fighter 2", year: 1995, description: { en: "The best arcade port of its time — drove Saturn sales through the roof in Japan", de: "Die beste Arcade-Portierung ihrer Zeit — trieb Saturn-Verkäufe in Japan in die Höhe" } },
      { title: "Panzer Dragoon Saga", year: 1998, description: { en: "Legendary RPG with only 30,000 copies in the West — worth thousands of euros today", de: "Legendäres RPG mit nur 30.000 Stück im Westen — heute tausende Euro wert" } },
      { title: "Radiant Silvergun", year: 1998, description: { en: "Treasure's masterpiece is considered one of the greatest shoot 'em ups of all time", de: "Treasures Meisterwerk gilt als einer der besten Shoot'em'ups aller Zeiten" } },
      { title: "Nights into Dreams...", year: 1996, description: { en: "Yuji Naka's dreamlike flight adventure with innovative analog controls", de: "Yuji Nakas traumhaftes Flugabenteuer mit innovativer Analog-Steuerung" } },
      { title: "Guardian Heroes", year: 1996, description: { en: "Treasure's beat 'em up RPG hybrid with branching paths and multiplayer chaos", de: "Treasures Beat'em'up-RPG-Hybrid mit verzweigten Pfaden und Mehrspieler-Chaos" } },
    ],
  },
  {
    platformId: "dreamcast",
    manufacturer: "Sega",
    releaseYear: 1998,
    alternateNames: ["Sega Dreamcast", "DC", "Katana (Codename)"],
    history: {
      en: [
        "The Dreamcast was Sega's final attempt in the console market — and technically far ahead of its time. As the first console with a built-in modem, it offered online multiplayer, web access, and even its own keyboard. The VMU (Visual Memory Unit) was a controller with a built-in mini screen that displayed minigames and game information — a concept that wouldn't resurface until the Wii U years later.",
        "The launch on 9/9/1999 was the most successful console launch in history — over 225,000 units sold on the first day in North America alone. Shenmue, the most expensive game of its time with a $70 million budget, offered an open game world with unprecedented detail. Jet Set Radio pioneered the cel-shading style, Crazy Taxi became an arcade hit, and Soul Calibur was hailed as the best fighting game of its generation.",
        "But the Dreamcast couldn't repair the damage caused by Sega's missteps in previous years. Third-party trust had been destroyed, and the announcement of the PlayStation 2 slowed sales. On January 31, 2001, Sega announced its withdrawal from the hardware market. The Dreamcast was discontinued after just two years and four months — a tragedy for the video game world."
      ],
      de: [
        "Der Dreamcast war Segas letzter Versuch im Konsolenmarkt — und technisch seiner Zeit weit voraus. Als erste Konsole mit eingebautem Modem bot er Online-Multiplayer, Webzugang und sogar eine eigene Tastatur. Die VMU (Visual Memory Unit) war ein Controller mit eingebautem Minibildschirm, auf dem Minispiele und Spielinformationen angezeigt wurden — ein Konzept, das erst die Wii U Jahre später wieder aufgriff.",
        "Der Launch am 9.9.1999 war der erfolgreichste Konsolenstart der Geschichte — über 225.000 Einheiten allein am ersten Tag in Nordamerika. Shenmue, das teuerste Spiel seiner Zeit mit einem Budget von 70 Millionen Dollar, bot eine offene Spielwelt mit nie dagewesenem Detailreichtum. Jet Set Radio prägte den Cel-Shading-Stil, Crazy Taxi wurde zum Arcade-Hit, und Soul Calibur galt als bestes Kampfspiel seiner Generation.",
        "Doch der Dreamcast konnte den Schaden nicht reparieren, den Segas Fehlentscheidungen der vorherigen Jahre angerichtet hatten. Das Vertrauen der Drittanbieter war zerstört, und die Ankündigung der PlayStation 2 bremste den Verkauf. Am 31. Januar 2001 kündigte Sega den Rückzug aus dem Hardwaremarkt an. Der Dreamcast wurde nach nur zwei Jahren und vier Monaten eingestellt — eine Tragödie für die Videospielwelt."
      ],
    },
    facts: {
      unitsSold: "9,13 Millionen",
      cpu: "Hitachi SH4 (200 MHz)",
      gameLibrary: { en: "620 official games", de: "620 offizielle Spiele" },
      launchPrice: "29.900 Yen / $199 (1999)",
    },
    milestones: [
      { title: "Shenmue", year: 1999, description: { en: "Pioneer of the open game world — the most expensive game of its time with a $70 million budget", de: "Pionier der offenen Spielwelt — das teuerste Spiel seiner Zeit mit 70 Mio. Dollar Budget" } },
      { title: "Soul Calibur", year: 1999, description: { en: "Considered a perfect arcade port and one of the best fighting games ever", de: "Galt als perfekte Arcade-Portierung und eines der besten Kampfspiele überhaupt" } },
      { title: "Jet Set Radio", year: 2000, description: { en: "Pioneered the cel-shading graphics style and offered unique graffiti gameplay mechanics", de: "Prägte den Cel-Shading-Grafikstil und bot einzigartige Graffiti-Gameplay-Mechaniken" } },
      { title: "Crazy Taxi", year: 1999, description: { en: "Pure arcade fun with a punk rock soundtrack — defined the chaos racer genre", de: "Arcade-Spaß pur mit Punk-Rock-Soundtrack — definierte das Chaos-Racer-Genre" } },
      { title: "Phantasy Star Online", year: 2000, description: { en: "First console online RPG — trailblazer for all future console MMOs", de: "Erstes Konsolen-Online-RPG — Wegbereiter für alle zukünftigen Konsolen-MMOs" } },
    ],
  },
  {
    platformId: "gamegear",
    manufacturer: "Sega",
    releaseYear: 1990,
    alternateNames: ["Sega Game Gear", "GG"],
    history: {
      en: [
        "The Game Gear was Sega's direct answer to the Game Boy — and on paper, it was vastly superior. A color, backlit display, technically based on the Master System, offered graphics that made Nintendo's monochrome handheld look outdated. But what won on paper lost in practice.",
        "The Game Gear's biggest problem was its enormous power consumption. Six AA batteries lasted only three to five hours — compared to over 30 hours on the Game Boy. This made the Game Gear impractical and expensive to use on the go. The device was also significantly larger and heavier than the Game Boy.",
        "The game library consisted largely of Master System ports, which effectively made the Game Gear a portable Master System variant. Titles like Sonic Triple Trouble, Shining Force: Sword of Hajya, and Columns were solid but couldn't compete with the Pokemon phenomenon that kept the Game Boy alive. After approximately 11 million units sold, Sega discontinued production in 1997."
      ],
      de: [
        "Der Game Gear war Segas direkte Antwort auf den Game Boy — und auf dem Papier war er haushoch überlegen. Ein farbiges, hintergrundbeleuchtetes Display, technisch basierend auf dem Master System, bot er eine Grafik, die Nintendos monochromen Handheld alt aussehen ließ. Doch was auf dem Papier gewann, verlor in der Praxis.",
        "Das größte Problem des Game Gear war der enorme Stromverbrauch. Sechs AA-Batterien hielten nur drei bis fünf Stunden — im Vergleich zu über 30 Stunden beim Game Boy. Dies machte den Game Gear unterwegs unpraktisch und teuer im Unterhalt. Zudem war das Gerät deutlich größer und schwerer als der Game Boy.",
        "Die Spielebibliothek bestand zu großen Teilen aus Master-System-Portierungen, was den Game Gear technisch zu einer tragbaren Master-System-Variante machte. Titel wie Sonic Triple Trouble, Shining Force: Sword of Hajya und Columns waren solide, konnten aber nicht mit dem Pokémon-Phänomen konkurrieren, das den Game Boy am Leben hielt. Nach rund 11 Millionen verkauften Einheiten stellte Sega die Produktion 1997 ein."
      ],
    },
    facts: {
      unitsSold: "10,62 Millionen",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: { en: "363 official games", de: "363 offizielle Spiele" },
      launchPrice: "19.800 Yen / $149,99 (1991)",
    },
    milestones: [
      { title: "Sonic the Hedgehog (GG)", year: 1991, description: { en: "Launch title that demonstrated technical superiority over the Game Boy", de: "Launch-Titel, der die technische Überlegenheit gegenüber dem Game Boy demonstrierte" } },
      { title: "Columns", year: 1990, description: { en: "Sega's answer to Tetris — an elegant puzzle game with jewels", de: "Segas Antwort auf Tetris — ein elegantes Puzzle-Spiel mit Juwelen" } },
      { title: "Shining Force: Sword of Hajya", year: 1993, description: { en: "A full-fledged tactical RPG on a handheld — impressive for its time", de: "Vollwertiges Taktik-RPG auf dem Handheld — beeindruckend für die damalige Zeit" } },
      { title: "TV-Tuner-Adapter", year: 1992, description: { en: "Accessory that transformed the Game Gear into a portable television", de: "Zubehör, das den Game Gear in einen tragbaren Fernseher verwandelte" } },
    ],
  },
  {
    platformId: "model2",
    manufacturer: "Sega",
    releaseYear: 1993,
    alternateNames: ["Sega Model 2", "Model 2A", "Model 2B", "Model 2C"],
    history: {
      en: [
        "The Sega Model 2 was an arcade system board that dominated the arcades of the 1990s. Developed in collaboration with Martin Marietta (now Lockheed Martin), it used military simulation technology for video games. The result was the most impressive 3D graphics you could see in an arcade in 1993.",
        "Virtua Fighter, Daytona USA, Virtua Cop, and The House of the Dead — the Model 2's titles defined an era. Daytona USA with its unforgettable soundtrack ('Daytonaaaa!') was one of the most profitable arcade games of all time. Virtua Fighter 2 set new standards for fighting games with its fluid animation and deep gameplay mechanics.",
        "The Model 2 went through three revisions (A, B, and C), with each improving texture capabilities and polygon performance. The hardware was so powerful that a faithful home console port wasn't possible until the Saturn's successor, the Dreamcast. Many Model 2 titles are still considered genre milestones to this day."
      ],
      de: [
        "Das Sega Model 2 war ein Arcade-Systemboard, das die Spielhallen der 90er Jahre dominierte. Entwickelt in Zusammenarbeit mit Martin Marietta (heute Lockheed Martin), nutzte es Technologie aus der Militärsimulation für Videospiele. Das Ergebnis war die beeindruckendste 3D-Grafik, die man 1993 in einer Spielhalle sehen konnte.",
        "Virtua Fighter, Daytona USA, Virtua Cop und The House of the Dead — die Titel des Model 2 prägten eine Ära. Daytona USA mit seinem unvergesslichen Soundtrack ('Daytonaaaa!') war eines der profitabelsten Arcade-Spiele aller Zeiten. Virtua Fighter 2 setzte neue Maßstäbe für Kampfspiele mit seiner flüssigen Animation und tiefen Spielmechanik.",
        "Das Model 2 durchlief drei Revisionen (A, B und C), wobei jede die Texturfähigkeiten und Polygonleistung verbesserte. Die Hardware war so leistungsfähig, dass eine originalgetreue Heimkonsolenportierung erst mit dem Saturn-Nachfolger Dreamcast möglich wurde. Viele Model-2-Titel gelten bis heute als Genre-Meilensteine."
      ],
    },
    facts: {
      unitsSold: "Arcade-System (kein Konsolen-Verkauf)",
      cpu: "Intel i960-KB (25 MHz) + Fujitsu TGP",
      gameLibrary: { en: "28 official titles", de: "28 offizielle Titel" },
      launchPrice: "Arcade-System (ca. $10.000-$20.000 pro Einheit)",
    },
    milestones: [
      { title: "Daytona USA", year: 1993, description: { en: "One of the most profitable arcade games of all time with a legendary soundtrack", de: "Eines der profitabelsten Arcade-Spiele aller Zeiten mit legendärem Soundtrack" } },
      { title: "Virtua Fighter 2", year: 1994, description: { en: "Set the standard for 3D fighting games at 60 fps and 700,000 polygons per second", de: "Setzte den Standard für 3D-Kampfspiele mit 60 fps und 700.000 Polygonen pro Sekunde" } },
      { title: "Virtua Cop", year: 1994, description: { en: "Defined the lightgun shooter with its targeting system and destructible environments", de: "Definierte den Lightgun-Shooter mit Zielsystem und zerstörbarer Umgebung" } },
      { title: "The House of the Dead", year: 1996, description: { en: "Founded one of the most popular arcade horror series", de: "Begründete eine der beliebtesten Arcade-Horror-Serien" } },
    ],
  },

  // ── Sony ──
  {
    platformId: "psx",
    manufacturer: "Sony",
    releaseYear: 1994,
    alternateNames: ["PlayStation", "PS1", "PSX", "PSone"],
    history: {
      en: [
        "The PlayStation was born from a failed partnership. Nintendo had commissioned Sony to develop a CD-ROM drive for the Super Nintendo. When Nintendo pulled out of the deal at the last minute and partnered with Philips instead, Ken Kutaragi — the father of the PlayStation — was deeply humiliated. What followed was one of the greatest acts of revenge in business history.",
        "Sony, an electronics giant with no experience in gaming, invested heavily in partnerships with third-party developers. While Nintendo continued to demand restrictive licensing terms, Sony offered more favorable conditions and CD-ROMs instead of expensive cartridges. This attracted developers like Square (Final Fantasy VII), Konami (Metal Gear Solid), and Naughty Dog (Crash Bandicoot).",
        "The PlayStation became the cultural phenomenon of the 1990s. It made video games socially acceptable for adults — the design was deliberately cool and not childish. Techno music, nightclubs, and underground culture shaped the marketing. With over 102 million units sold, the PlayStation changed the video game landscape forever and made Sony the market leader."
      ],
      de: [
        "Die PlayStation entstand aus einer gescheiterten Partnerschaft. Nintendo hatte Sony beauftragt, ein CD-ROM-Laufwerk für das Super Nintendo zu entwickeln. Als Nintendo den Deal in letzter Minute platzen ließ und stattdessen mit Philips zusammenarbeitete, war Ken Kutaragi — der Vater der PlayStation — zutiefst gedemütigt. Was folgte, war einer der größten Racheakte der Wirtschaftsgeschichte.",
        "Sony, ein Elektronikgigant ohne Erfahrung im Spielebereich, investierte massiv in Partnerschaften mit Drittanbietern. Während Nintendo weiterhin restriktive Lizenzbedingungen verlangte, bot Sony günstigere Konditionen und CD-ROMs statt teurer Module. Dies lockte Entwickler wie Square (Final Fantasy VII), Konami (Metal Gear Solid) und Naughty Dog (Crash Bandicoot) an.",
        "Die PlayStation wurde zum kulturellen Phänomen der 90er Jahre. Sie machte Videospiele für Erwachsene gesellschaftsfähig — das Design war bewusst kühl und nicht kindlich. Techno-Musik, Nachtclubs und Underground-Kultur prägten das Marketing. Mit über 102 Millionen verkauften Einheiten veränderte die PlayStation die Videospiellandschaft für immer und machte Sony zum Marktführer."
      ],
    },
    facts: {
      unitsSold: "102,49 Millionen",
      cpu: "R3000A (33,87 MHz)",
      gameLibrary: { en: "2,500+ games", de: "2.500+ Spiele" },
      launchPrice: "39.800 Yen / $299 (1995)",
    },
    milestones: [
      { title: "Final Fantasy VII", year: 1997, description: { en: "Brought JRPGs into the mainstream and was the reason millions bought a PlayStation", de: "Brachte JRPGs in den Mainstream und war der Grund, warum Millionen eine PlayStation kauften" } },
      { title: "Metal Gear Solid", year: 1998, description: { en: "Defined the stealth genre and elevated video game storytelling to cinematic levels", de: "Definierte das Stealth-Genre und hob Videospiel-Erzählung auf Filmniveau" } },
      { title: "Resident Evil", year: 1996, description: { en: "Founded the survival horror genre and shaped a generation of gamers", de: "Begründete das Survival-Horror-Genre und prägte eine Generation von Spielern" } },
      { title: "Crash Bandicoot", year: 1996, description: { en: "Sony's unofficial mascot — proved that PlayStation could offer fun for younger audiences too", de: "Sonys inoffizielles Maskottchen — bewies, dass PlayStation auch Spaß für Junge bieten konnte" } },
      { title: "Gran Turismo", year: 1997, description: { en: "Revolutionized the racing genre with meticulous car simulation and over 10 million units sold", de: "Revolutionierte das Rennspiel-Genre mit akribischer Autosimulation und über 10 Mio. verkauften Einheiten" } },
    ],
  },
  {
    platformId: "ps2",
    manufacturer: "Sony",
    releaseYear: 2000,
    alternateNames: ["PlayStation 2", "PS2"],
    history: {
      en: [
        "The PlayStation 2 is the best-selling game console of all time — over 155 million units across 13 years of production. Its success was built on a clever strategy: at launch, it was the cheapest DVD player on the market, attracting many buyers who primarily wanted to watch movies. Once in the living room, DVD viewers became gamers.",
        "Backward compatibility with the original PlayStation ensured a massive game library from day one. But the PS2 quickly built its own legendary collection. Grand Theft Auto III defined the open-world formula. God of War set new benchmarks for action games. Shadow of the Colossus proved that games could be art. The diversity was breathtaking.",
        "Even when the Xbox 360 and PlayStation 3 were already on the market, the PS2 continued to sell. The last official game, Pro Evolution Soccer 2014, was released in November 2013 — thirteen years after launch. This unprecedented longevity testifies to the strength of a platform that shaped an entire medium."
      ],
      de: [
        "Die PlayStation 2 ist die meistverkaufte Spielkonsole aller Zeiten — über 155 Millionen Einheiten in 13 Jahren Produktionszeit. Ihr Erfolg basierte auf einer klugen Strategie: Sie war bei Launch der günstigste DVD-Player auf dem Markt, was viele Käufer anzog, die primär Filme schauen wollten. Einmal im Wohnzimmer, wurden aus DVD-Zuschauern Spieler.",
        "Die Rückwärtskompatibilität mit der originalen PlayStation sicherte vom ersten Tag an eine riesige Spielebibliothek. Doch die PS2 baute schnell eine eigene, legendäre Sammlung auf. Grand Theft Auto III definierte die Open-World-Formel. God of War setzte neue Maßstäbe für Action-Spiele. Shadow of the Colossus bewies, dass Spiele Kunst sein können. Die Vielfalt war atemberaubend.",
        "Selbst als Xbox 360 und PlayStation 3 bereits auf dem Markt waren, verkaufte sich die PS2 weiter. Das letzte offizielle Spiel, Pro Evolution Soccer 2014, erschien im November 2013 — dreizehn Jahre nach dem Launch. Diese beispiellose Langlebigkeit zeugt von der Stärke einer Plattform, die ein ganzes Medium prägte."
      ],
    },
    facts: {
      unitsSold: "155 Millionen",
      cpu: "Emotion Engine (294,912 MHz)",
      gameLibrary: { en: "4,489 official games", de: "4.489 offizielle Spiele" },
      launchPrice: "39.800 Yen / $299 (2000)",
    },
    milestones: [
      { title: "Grand Theft Auto: San Andreas", year: 2004, description: { en: "Massive open world with unprecedented freedom — cultural phenomenon of the 2000s", de: "Riesige offene Spielwelt mit beispielloser Freiheit — kulturelles Phänomen der 2000er" } },
      { title: "Shadow of the Colossus", year: 2005, description: { en: "Only 16 bosses, no enemies in between — an artistic masterpiece that legitimized games as an art form", de: "Nur 16 Bosse, keine Gegner dazwischen — ein künstlerisches Meisterwerk, das Spiele als Kunstform legitimierte" } },
      { title: "Metal Gear Solid 3: Snake Eater", year: 2004, description: { en: "Perfected the stealth genre with camouflage, survival elements, and a heartbreaking story", de: "Perfektionierte das Stealth-Genre mit Tarnung, Survival-Elementen und einer herzzerreißenden Story" } },
      { title: "Final Fantasy X", year: 2001, description: { en: "First fully voice-acted Final Fantasy with an emotional story and over 8 million units sold", de: "Erstes vollvertontes Final Fantasy mit emotionaler Geschichte und über 8 Mio. verkauften Einheiten" } },
      { title: "God of War", year: 2005, description: { en: "Brutal action game inspired by Greek mythology — launched a mega franchise", de: "Brutales Actionspiel inspiriert von griechischer Mythologie — begründete eine Mega-Franchise" } },
    ],
  },
  {
    platformId: "ps3",
    manufacturer: "Sony",
    releaseYear: 2006,
    alternateNames: ["PlayStation 3", "PS3"],
    history: {
      en: [
        "The PlayStation 3 had arguably the most difficult launch of any Sony console. The $599 price tag — driven by the expensive Cell processor and Blu-ray drive — shocked the industry. Ken Kutaragi's infamous statement that consumers should 'work more' to afford the PS3 became a PR disaster. The Xbox 360 had a one-year head start and was significantly cheaper.",
        "But Sony fought back. The Cell processor, though notoriously difficult to program, enabled technical masterpieces when developers understood its quirks. Naughty Dog's The Last of Us and the Uncharted series demonstrated what the hardware could do. PlayStation Network was offered for free — an advantage over Microsoft's paid Xbox Live service.",
        "In the long run, Sony's Blu-ray strategy paid off. The PS3 was once again one of the cheapest Blu-ray players and helped the format win the format war against HD-DVD. By the end of its lifecycle, the PS3 had caught up with the Xbox 360 in worldwide sales and offered one of the strongest exclusive libraries in console history."
      ],
      de: [
        "Die PlayStation 3 hatte den wohl schwierigsten Start einer Sony-Konsole. Der Preis von $599 beim Launch — bedingt durch den teuren Cell-Prozessor und das Blu-ray-Laufwerk — schockte die Branche. Ken Kutaragis berühmte Aussage, Konsumenten sollten 'mehr arbeiten', um sich die PS3 leisten zu können, wurde zum PR-Desaster. Die Xbox 360 hatte ein Jahr Vorsprung und war deutlich günstiger.",
        "Doch Sony kämpfte sich zurück. Der Cell-Prozessor, obwohl schwer zu programmieren, ermöglichte technische Meisterleistungen wenn Entwickler seine Eigenheiten verstanden. Naughty Dogs The Last of Us und Uncharted-Serie zeigten, was die Hardware konnte. Das PlayStation Network wurde kostenlos angeboten — ein Vorteil gegenüber Microsofts kostenpflichtigem Xbox Live.",
        "Langfristig zahlte sich Sonys Blu-ray-Strategie aus. Die PS3 war erneut einer der günstigsten Blu-ray-Player und half dem Format, den Formatkrieg gegen HD-DVD zu gewinnen. Gegen Ende ihres Lebenszyklus hatte die PS3 die Xbox 360 bei den weltweiten Verkaufszahlen eingeholt und bot eine der stärksten Exklusiv-Bibliotheken der Konsolengeschichte."
      ],
    },
    facts: {
      unitsSold: "87,4 Millionen",
      cpu: "Cell Broadband Engine (3,2 GHz)",
      gameLibrary: { en: "2,565 official games", de: "2.565 offizielle Spiele" },
      launchPrice: "59.980 Yen / $499-$599 (2006)",
    },
    milestones: [
      { title: "The Last of Us", year: 2013, description: { en: "Emotional masterpiece by Naughty Dog that pushed the boundaries of video game storytelling", de: "Emotionales Meisterwerk von Naughty Dog, das die Grenzen von Videospiel-Erzählung verschob" } },
      { title: "Uncharted 2: Among Thieves", year: 2009, description: { en: "Set new standards for cinematic action-adventure design", de: "Setzte neue Standards für cineastisches Action-Adventure-Design" } },
      { title: "Demon's Souls", year: 2009, description: { en: "Founded the 'Soulslike' genre and inspired Dark Souls, Elden Ring, and countless imitators", de: "Begründete das 'Soulslike'-Genre und inspirierte Dark Souls, Elden Ring und unzählige Nachahmer" } },
      { title: "Metal Gear Solid 4", year: 2008, description: { en: "Epic finale of the Solid Snake saga with cinematic cutscenes", de: "Episches Finale der Solid-Snake-Saga mit filmreifen Cutscenes" } },
      { title: "Journey", year: 2012, description: { en: "Wordless multiplayer experience that was the first game to receive a Grammy nomination", de: "Wortloses Multiplayer-Erlebnis, das als erstes Spiel eine Grammy-Nominierung erhielt" } },
    ],
  },
  {
    platformId: "psp",
    manufacturer: "Sony",
    releaseYear: 2004,
    alternateNames: ["PlayStation Portable", "PSP"],
    history: {
      en: [
        "The PlayStation Portable was Sony's first foray into the handheld market — and a direct attack on Nintendo's dominance. With a large, beautiful widescreen display, impressive 3D graphics (near PS2 level), and the proprietary UMD disc format, the PSP offered a handheld experience that eclipsed everything before it.",
        "Sony's vision was a 'portable media center' — besides games, the PSP could play movies on UMD, listen to music, and browse the internet. These multimedia capabilities appealed to an older audience. In Japan, the PSP was a massive success, primarily thanks to Monster Hunter. The Monster Hunter titles sold millions and made the PSP ubiquitous on Japanese trains.",
        "Despite strong sales figures, the PSP could never overtake the Nintendo DS. The UMD discs were slow, fragile, and eventually drove users away — Sony switched to memory cards with the successor PS Vita. The active homebrew and modding scene keeps the PSP alive to this day, and PSP emulation on modern devices is excellent."
      ],
      de: [
        "Die PlayStation Portable war Sonys erster Versuch im Handheld-Markt — und ein direkter Angriff auf Nintendos Dominanz. Mit einem großen, wunderschönen Breitbild-Display, beeindruckender 3D-Grafik (nahe PS2-Niveau) und dem proprietären UMD-Disc-Format bot die PSP eine Handheld-Erfahrung, die alles Bisherige in den Schatten stellte.",
        "Sonys Vision war ein 'tragbares Mediacenter' — neben Spielen konnte die PSP Filme auf UMD abspielen, Musik hören und im Internet surfen. Diese Multimediafähigkeiten sprachen ein älteres Publikum an. In Japan war die PSP ein Riesenerfolg, vor allem dank Monster Hunter. Die Monster-Hunter-Titel verkauften Millionen und machten die PSP in japanischen Zügen allgegenwärtig.",
        "Trotz starker Verkaufszahlen konnte die PSP den Nintendo DS nie überholen. Die UMD-Discs waren langsam, fragil und vergraulten später die Nutzer — Sony wechselte mit dem Nachfolger PS Vita auf Speicherkarten. Die aktive Homebrew- und Modding-Szene hält die PSP bis heute am Leben, und die PSP-Emulation auf modernen Geräten ist hervorragend."
      ],
    },
    facts: {
      unitsSold: "80 Millionen",
      cpu: "MIPS R4000 (333 MHz)",
      gameLibrary: { en: "1,367 official games", de: "1.367 offizielle Spiele" },
      launchPrice: "19.800 Yen / $249 (2005)",
    },
    milestones: [
      { title: "Monster Hunter Freedom Unite", year: 2008, description: { en: "Sold over 5 million units in Japan and defined cooperative handheld gaming", de: "Verkaufte über 5 Millionen Einheiten in Japan und definierte kooperatives Handheld-Gaming" } },
      { title: "God of War: Chains of Olympus", year: 2008, description: { en: "Proved that console-quality experiences were possible on a handheld", de: "Bewies, dass Konsolenerfahrungen auf dem Handheld möglich sind" } },
      { title: "Crisis Core: Final Fantasy VII", year: 2007, description: { en: "Prequel to FF VII with an emotional story centered on Zack Fair", de: "Prequel zu FF VII mit emotionaler Geschichte um Zack Fair" } },
      { title: "Grand Theft Auto: Liberty City Stories", year: 2005, description: { en: "A full GTA experience in your pocket — a technical marvel for the PSP", de: "Vollwertiges GTA in der Hosentasche — ein technisches Wunderwerk für die PSP" } },
      { title: "Persona 3 Portable", year: 2009, description: { en: "Definitive version of the beloved RPG with a female protagonist option", de: "Definitive Version des beliebten RPGs mit weiblicher Protagonisten-Option" } },
    ],
  },
  {
    platformId: "psvita",
    manufacturer: "Sony",
    releaseYear: 2011,
    alternateNames: ["PlayStation Vita", "PS Vita", "NGP (Next Generation Portable)"],
    history: {
      en: [
        "The PlayStation Vita was technically impressive — an OLED touchscreen, a rear touchpad, two analog sticks, and graphics approaching PS3 quality. Sony promised 'console quality on the go' and delivered hardware that could have fulfilled that promise. But the market had changed.",
        "Smartphones had taken over the casual gaming market, and many players saw no reason to buy a dedicated handheld device. Sony's own studios pulled support early, leading to a lack of blockbuster titles. The proprietary and overpriced memory cards further frustrated customers.",
        "Despite its commercial failure, the Vita found a loyal niche among indie and Japanese game fans. Persona 4 Golden, Gravity Rush, and Danganronpa made it an essential platform for lovers of Japanese games. The Vita community remains passionate to this day, and the console is considered one of the greatest 'what if' moments in video game history."
      ],
      de: [
        "Die PlayStation Vita war technisch beeindruckend — ein OLED-Touchscreen, ein rückseitiges Touchpad, zwei Analogsticks und Grafik nahe PS3-Niveau. Sony versprach 'Konsolenqualität für unterwegs' und lieferte Hardware, die dieses Versprechen hätte einlösen können. Doch der Markt hatte sich verändert.",
        "Smartphones hatten den Casual-Gaming-Markt übernommen, und viele Spieler sahen keinen Grund, ein dediziertes Handheld-Gerät zu kaufen. Sonys eigene Studios stellten die Unterstützung früh ein, was zu einem Mangel an Blockbuster-Titeln führte. Die proprietären und überteuerten Speicherkarten verärgerten die Kunden zusätzlich.",
        "Trotz des kommerziellen Misserfolgs fand die Vita eine treue Nische bei Indie- und japanischen Spielen. Persona 4 Golden, Gravity Rush und Danganronpa machten sie zur unverzichtbaren Plattform für Liebhaber japanischer Spiele. Die Vita-Community ist bis heute leidenschaftlich, und die Konsole gilt als einer der größten 'Was wäre wenn'-Momente der Videospielgeschichte."
      ],
    },
    facts: {
      unitsSold: "15,9 Millionen",
      cpu: "ARM Cortex-A9 MPCore (Quad-Core, 2 GHz)",
      gameLibrary: { en: "1,500+ games", de: "1.500+ Spiele" },
      launchPrice: "24.980 Yen / $249 (2012)",
    },
    milestones: [
      { title: "Persona 4 Golden", year: 2012, description: { en: "Definitive version of the RPG classic — considered the main reason to buy a Vita", de: "Definitive Version des RPG-Klassikers — galt als Hauptgrund, eine Vita zu kaufen" } },
      { title: "Gravity Rush", year: 2012, description: { en: "Unique gravity-shifting gameplay that utilized the Vita's touchscreen and motion controls", de: "Einzigartiges Schwerkraft-Gameplay, das die Touchscreen- und Bewegungssteuerung der Vita nutzte" } },
      { title: "Uncharted: Golden Abyss", year: 2011, description: { en: "Proved that AAA action-adventures were possible on a handheld", de: "Bewies, dass AAA-Action-Adventures auf dem Handheld möglich sind" } },
      { title: "Danganronpa: Trigger Happy Havoc", year: 2013, description: { en: "Murder mystery visual novel that built a global fanbase", de: "Visual Novel mit Mord-Mysterium, die eine globale Fangemeinde aufbaute" } },
    ],
  },

  // ── Microsoft ──
  {
    platformId: "xbox",
    manufacturer: "Microsoft",
    releaseYear: 2001,
    alternateNames: ["Xbox", "Xbox Original", "OG Xbox"],
    history: {
      en: [
        "When Microsoft announced the Xbox in 2001, the industry laughed. A software company in the console market? Bill Gates personally unveiled the console at the Game Developers Conference, emphasizing that the Xbox would be the most powerful console ever — with an Intel Pentium III processor and an NVIDIA graphics card, it offered PC-like hardware in a console shell.",
        "The Xbox initially lacked Japanese support, but Microsoft compensated with western exclusives. Halo: Combat Evolved changed the gaming landscape forever — it proved that first-person shooters could not only work on consoles but surpass their PC counterparts. The Master Chief became an icon overnight.",
        "The Xbox's greatest innovation was Xbox Live — the first truly functional online multiplayer service for consoles. Halo 2 became the first major online console shooter, and the infrastructure Microsoft built here shaped online gaming for generations. Financially, Microsoft lost billions on the Xbox, but the strategic investment in the gaming market paid off in the long run."
      ],
      de: [
        "Als Microsoft 2001 die Xbox ankündigte, lachte die Branche. Ein Softwareunternehmen im Konsolenmarkt? Bill Gates persönlich stellte die Konsole auf der Game Developers Conference vor und betonte, dass die Xbox die leistungsfähigste Konsole aller Zeiten sein würde — mit einem Intel-Pentium-III-Prozessor und einer NVIDIA-Grafikkarte bot sie PC-ähnliche Hardware in einem Konsolengehäuse.",
        "Der Xbox fehlte es anfangs an japanischer Unterstützung, aber Microsoft machte dies mit westlichen Exklusivtiteln wett. Halo: Combat Evolved veränderte die Spielelandschaft für immer — es bewies, dass Ego-Shooter auf Konsolen nicht nur funktionieren, sondern die PC-Versionen übertreffen können. Der Master Chief wurde über Nacht zur Ikone.",
        "Die größte Innovation der Xbox war Xbox Live — der erste wirklich funktionierende Online-Multiplayer-Dienst für Konsolen. Halo 2 wurde zum ersten großen Online-Konsolen-Shooter, und die Infrastruktur, die Microsoft hier aufbaute, prägte das Online-Gaming für Generationen. Finanziell verlor Microsoft Milliarden mit der Xbox, aber die strategische Investition in den Gaming-Markt zahlte sich langfristig aus."
      ],
    },
    facts: {
      unitsSold: "24 Millionen",
      cpu: "Intel Pentium III (733 MHz)",
      gameLibrary: { en: "1,000+ games", de: "1.000+ Spiele" },
      launchPrice: "$299 (2001)",
    },
    milestones: [
      { title: "Halo: Combat Evolved", year: 2001, description: { en: "Defined the console first-person shooter and made the Xbox relevant overnight", de: "Definierte den Konsolen-Ego-Shooter und machte die Xbox über Nacht relevant" } },
      { title: "Halo 2", year: 2004, description: { en: "Pioneer of console online multiplayer via Xbox Live", de: "Pionier des Konsolen-Online-Multiplayers über Xbox Live" } },
      { title: "Star Wars: Knights of the Old Republic", year: 2003, description: { en: "BioWare's masterpiece — one of the greatest RPGs of all time", de: "BioWares Meisterwerk — eines der besten RPGs aller Zeiten" } },
      { title: "Fable", year: 2004, description: { en: "Peter Molyneux's ambitious RPG with a good/evil morality system", de: "Peter Molyneuxs ambitioniertes RPG mit Gut/Böse-Moral-System" } },
      { title: "Xbox Live Launch", year: 2002, description: { en: "First functional online service for consoles — changed the industry permanently", de: "Erster funktionierender Online-Dienst für Konsolen — veränderte die Branche nachhaltig" } },
    ],
  },
  {
    platformId: "xbox360",
    manufacturer: "Microsoft",
    releaseYear: 2005,
    alternateNames: ["Xbox 360", "Xenon (Codename)"],
    history: {
      en: [
        "The Xbox 360 launched a year before the PlayStation 3 and skillfully exploited that head start. Microsoft had learned from the original Xbox's mistakes: the design was sleeker, the controller refined, and Xbox Live expanded into a full social network. Gamerscore, Achievements, and the Xbox Live Marketplace set standards that the entire industry adopted.",
        "The 360 had a dark secret, however: the 'Red Ring of Death' (RROD). A design flaw in early models caused massive hardware failures — the failure rate was estimated at 23-54%. Microsoft had to set aside over one billion dollars for warranty extensions. Despite this debacle, the fanbase remained loyal — a testament to the strength of the game library.",
        "The Xbox 360 shaped an entire console generation. Gears of War defined the cover shooter, Mass Effect created an epic science fiction trilogy, and Xbox Live Arcade made indie games popular on consoles. Titles like Braid, Castle Crashers, and Limbo found their first major audience here and paved the way for the indie revolution."
      ],
      de: [
        "Die Xbox 360 erschien ein Jahr vor der PlayStation 3 und nutzte diesen Vorsprung geschickt. Microsoft hatte aus den Fehlern der ersten Xbox gelernt: Das Design war schlanker, der Controller überarbeitet und Xbox Live zu einem vollwertigen sozialen Netzwerk ausgebaut. Gamerscore, Achievements und der Xbox Live Marketplace setzten Standards, die die gesamte Branche übernahm.",
        "Die 360 hatte jedoch ein dunkles Geheimnis: den 'Red Ring of Death' (RROD). Ein Designfehler führte bei frühen Modellen zu massiven Hardwareausfällen — die Ausfallrate lag bei geschätzt 23-54%. Microsoft musste über eine Milliarde Dollar für Garantieverlängerungen zurückstellen. Trotz dieses Debakels blieb die Fangemeinde treu — ein Zeugnis der Stärke der Spielebibliothek.",
        "Die Xbox 360 prägte eine ganze Konsolengeneration. Gears of War definierte den Deckungsshooter, Mass Effect schuf eine epische Science-Fiction-Trilogie, und Xbox Live Arcade machte Indie-Spiele auf Konsolen populär. Titel wie Braid, Castle Crashers und Limbo fanden hier ihr erstes großes Publikum und ebneten den Weg für die Indie-Revolution."
      ],
    },
    facts: {
      unitsSold: "84 Millionen",
      cpu: "IBM Xenon (3,2 GHz, Triple-Core)",
      gameLibrary: { en: "2,154 official games", de: "2.154 offizielle Spiele" },
      launchPrice: "$299-$399 (2005)",
    },
    milestones: [
      { title: "Gears of War", year: 2006, description: { en: "Defined the cover shooter and set new graphics benchmarks with Unreal Engine 3", de: "Definierte den Deckungsshooter und setzte neue Grafik-Maßstäbe mit der Unreal Engine 3" } },
      { title: "Mass Effect 2", year: 2010, description: { en: "Perfect blend of action gameplay and branching narrative", de: "Perfekte Verbindung von Action-Gameplay und verzweigter Erzählung" } },
      { title: "Halo 3", year: 2007, description: { en: "Earned $170 million on day one — the biggest media launch in history at the time", de: "Erwirtschaftete 170 Millionen Dollar am ersten Tag — größter Medienstart der Geschichte zu dieser Zeit" } },
      { title: "The Elder Scrolls V: Skyrim", year: 2011, description: { en: "Though multiplatform, Skyrim defined the Xbox 360 era like few other games", de: "Obwohl multiplattform, prägte Skyrim die Xbox-360-Ära wie kaum ein anderes Spiel" } },
      { title: "Xbox Live Arcade", year: 2005, description: { en: "Platform for indie games that popularized Braid, Limbo, and Castle Crashers", de: "Plattform für Indie-Spiele, die Braid, Limbo und Castle Crashers populär machte" } },
    ],
  },  // ── Atari ──
  {
    platformId: "atari2600",
    manufacturer: "Atari",
    releaseYear: 1977,
    alternateNames: ["Atari VCS", "Atari 2600", "Heavy Sixer"],
    history: {
      en: [
        "The Atari 2600, originally sold as the Video Computer System (VCS), was the console that brought video games into living rooms around the world. Before the VCS, consoles were limited to hardwired built-in games — the 2600 introduced swappable game cartridges, effectively creating the modern console market. Atari co-founder Nolan Bushnell sold the company to Warner Communications to fund its development.",
        "Success did not come immediately. It was not until 1980, with the port of Space Invaders, that the market exploded. Space Invaders became the first 'system seller' — people bought the 2600 just for that one game. Pac-Man, Pitfall!, River Raid, and Adventure followed, the latter establishing the first Easter egg tradition in video games (developer Warren Robinett hid his name inside the game).",
        "Yet Atari's lack of quality control led to the infamous video game crash of 1983. The E.T. game, developed in just five weeks, became the symbol of the crash — millions of unsold cartridges were allegedly buried in a landfill in New Mexico (actually excavated and confirmed in 2014). Nevertheless, the 2600 remains unforgotten as the trailblazer of the entire industry.",
      ],
      de: [
        "Der Atari 2600, ursprünglich als Video Computer System (VCS) verkauft, war die Konsole, die Videospiele in die Wohnzimmer der Welt brachte. Vor dem VCS waren Konsolen auf fest einprogrammierte Spiele beschränkt — der 2600 führte austauschbare Spielmodule ein und schuf damit den modernen Konsolenmarkt. Atari-Mitgründer Nolan Bushnell verkaufte das Unternehmen an Warner Communications, um die Entwicklung zu finanzieren.",
        "Der Erfolg kam nicht sofort. Erst 1980, mit der Portierung von Space Invaders, explodierte der Markt. Space Invaders wurde zum ersten 'Systemseller' — Menschen kauften den 2600 nur für dieses eine Spiel. Es folgten Pac-Man, Pitfall!, River Raid und Adventure, das die erste Easter-Egg-Tradition in Videospielen begründete (Entwickler Warren Robinett versteckte seinen Namen im Spiel).",
        "Doch Ataris mangelnde Qualitätskontrolle führte zum berühmten Videospiel-Crash von 1983. Das E.T.-Spiel, in nur fünf Wochen entwickelt, wurde zum Symbol des Crashs — Millionen unverkaufter Module wurden angeblich auf einer Müllhalde in New Mexico vergraben (2014 tatsächlich ausgegraben und bestätigt). Trotzdem bleibt der 2600 als Wegbereiter der gesamten Industrie unvergessen.",
      ],
    },
    facts: {
      unitsSold: "30 Millionen",
      cpu: "MOS 6507 (1,19 MHz)",
      gameLibrary: { en: "565 official games", de: "565 offizielle Spiele" },
      launchPrice: "$199 (1977)",
    },
    milestones: [
      { title: "Space Invaders", year: 1980, description: { en: "First 'system seller' — quadrupled the 2600's sales figures", de: "Erster 'Systemseller' — vervierfachte die Verkaufszahlen des 2600" } },
      { title: "Pitfall!", year: 1982, description: { en: "By David Crane at Activision — considered a precursor to the platformer genre", de: "Von David Crane bei Activision — gilt als Vorläufer des Jump'n'Run-Genres" } },
      { title: "Adventure", year: 1980, description: { en: "First action-adventure and origin of the Easter egg tradition in video games", de: "Erstes Action-Adventure und Ursprung der Easter-Egg-Tradition in Videospielen" } },
      { title: "E.T. the Extra-Terrestrial", year: 1982, description: { en: "Developed in five weeks — became the symbol of the 1983 video game crash", de: "In fünf Wochen entwickelt — wurde zum Symbol des Videospiel-Crashs von 1983" } },
      { title: "Activision-Gründung", year: 1979, description: { en: "Frustrated Atari developers founded the first independent game publisher in history", de: "Frustrierte Atari-Entwickler gründeten den ersten unabhängigen Spielepublisher der Geschichte" } },
    ],
  },
  {
    platformId: "atari5200",
    manufacturer: "Atari",
    releaseYear: 1982,
    alternateNames: ["Atari 5200 SuperSystem"],
    history: {
      en: [
        "The Atari 5200 was conceived as the successor to the enormously successful 2600 and was internally based on the Atari 400 computer. It offered better graphics and sound but was plagued by several design flaws. The biggest point of criticism was the analog controller — it was fragile, did not self-center, and broke frequently.",
        "To make matters worse, the 5200 was not backward compatible with the massive 2600 catalog. Atari later released an adapter, but the damage was already done. On top of that, the video game crash of 1983 caused the entire market to collapse. In this toxic environment, the 5200 never stood a chance.",
        "Despite these problems, the 5200 offered some technically impressive arcade ports. The versions of Moon Patrol, Galaxian, and Centipede were clearly superior to their 2600 counterparts. The 5200 sold only around one million units and was quietly discontinued in 1984 — steamrolled by its own successor, the Atari 7800.",
      ],
      de: [
        "Der Atari 5200 war als Nachfolger des äußerst erfolgreichen 2600 konzipiert und basierte intern auf dem Atari-400-Computer. Er bot bessere Grafik und Sound, wurde aber von mehreren Designfehlern geplagt. Der größte Kritikpunkt war der analoge Controller — er war fragil, zentrierte sich nicht selbst und ging häufig kaputt.",
        "Erschwerend kam hinzu, dass der 5200 nicht rückwärtskompatibel mit dem riesigen 2600-Katalog war. Atari brachte später einen Adapter heraus, doch der Schaden war bereits angerichtet. Hinzu kam der Videospiel-Crash von 1983, der den gesamten Markt zusammenbrechen ließ. In diesem toxischen Umfeld hatte der 5200 keine Chance.",
        "Trotz dieser Probleme bot der 5200 einige technisch beeindruckende Arcade-Portierungen. Die Version von Moon Patrol, Galaxian und Centipede waren den 2600-Versionen deutlich überlegen. Der 5200 verkaufte nur rund eine Million Einheiten und wurde 1984 still eingestellt — überrollt vom eigenen Nachfolger, dem Atari 7800.",
      ],
    },
    facts: {
      unitsSold: "ca. 1 Million",
      cpu: "MOS 6502C (1,79 MHz)",
      gameLibrary: { en: "69 official games", de: "69 offizielle Spiele" },
      launchPrice: "$269 (1982)",
    },
    milestones: [
      { title: "Super Breakout", year: 1982, description: { en: "One of the best launch titles and a technically impressive port", de: "Einer der besten Launch-Titel und technisch beeindruckende Portierung" } },
      { title: "Centipede", year: 1982, description: { en: "Accurate arcade port that made meaningful use of the analog controller", de: "Akkurate Arcade-Portierung, die den analogen Controller sinnvoll nutzte" } },
      { title: "Moon Patrol", year: 1983, description: { en: "Excellent port of the arcade classic featuring parallax scrolling", de: "Exzellente Portierung des Arcade-Klassikers mit Parallax-Scrolling" } },
    ],
  },
  {
    platformId: "atari7800",
    manufacturer: "Atari",
    releaseYear: 1986,
    alternateNames: ["Atari 7800 ProSystem"],
    history: {
      en: [
        "The Atari 7800 could have been Atari's salvation — the console was already finished in 1984 and technically on par with the NES. However, the sale of Atari to Jack Tramiel (the former Commodore chief) delayed the launch by two years. By the time the 7800 finally appeared in 1986, Nintendo had already seized firm control of the North American market.",
        "The 7800's greatest strength was its full backward compatibility with the Atari 2600 — hundreds of games were immediately available. The hardware offered excellent 2D graphics with many sprites on screen, which was ideal for arcade ports. The sound, however, was barely better than the 2600 unless games utilized the POKEY chip.",
        "Atari failed to attract third-party developers — most had long since committed to Nintendo. The game library consisted mostly of arcade ports and first-party titles. Nevertheless, the 7800 is a popular collector's item, and its arcade ports of titles like Food Fight and Galaga are considered excellent.",
      ],
      de: [
        "Der Atari 7800 hätte Ataris Rettung sein können — die Konsole war bereits 1984 fertig und technisch dem NES ebenbürtig. Doch durch den Verkauf von Atari an Jack Tramiel (den ehemaligen Commodore-Chef) wurde der Launch um zwei Jahre verzögert. Als der 7800 1986 endlich erschien, hatte Nintendo den nordamerikanischen Markt bereits fest im Griff.",
        "Die größte Stärke des 7800 war seine vollständige Rückwärtskompatibilität mit dem Atari 2600 — hunderte Spiele waren sofort verfügbar. Die Hardware bot hervorragende 2D-Grafik mit vielen Sprites auf dem Bildschirm, was besonders für Arcade-Portierungen ideal war. Der Sound hingegen war kaum besser als beim 2600, es sei denn, Spiele nutzten den POKEY-Chip.",
        "Atari versäumte es, Drittanbieter zu gewinnen — die meisten Entwickler hatten sich längst Nintendo verschrieben. Die Spielebibliothek bestand größtenteils aus Arcade-Portierungen und Eigenentwicklungen. Trotzdem ist der 7800 ein beliebtes Sammlerstück, und seine Arcade-Ports von Titeln wie Food Fight und Galaga gelten als ausgezeichnet.",
      ],
    },
    facts: {
      unitsSold: "ca. 3,77 Millionen",
      cpu: "Sally 6502C (1,79 MHz)",
      gameLibrary: { en: "59 official games", de: "59 offizielle Spiele" },
      launchPrice: "$79,95 (1986)",
    },
    milestones: [
      { title: "Food Fight", year: 1987, description: { en: "Excellent arcade port that showcased the hardware's sprite capabilities", de: "Exzellente Arcade-Portierung, die die Sprite-Fähigkeiten der Hardware zeigte" } },
      { title: "Galaga", year: 1987, description: { en: "Outstanding adaptation of the arcade classic", de: "Hervorragende Umsetzung des Arcade-Klassikers" } },
      { title: "Atari 2600-Kompatibilität", year: 1986, description: { en: "Full backward compatibility with the massive 2600 library", de: "Vollständige Abwärtskompatibilität mit der riesigen 2600-Bibliothek" } },
    ],
  },
  {
    platformId: "atari800",
    manufacturer: "Atari",
    releaseYear: 1979,
    alternateNames: ["Atari 800", "Atari XL", "Atari XE", "Atari 8-Bit-Familie"],
    history: {
      en: [
        "The Atari 8-bit computers were ahead of their time in many respects. The Atari 800 debuted in 1979 with custom chips for graphics (ANTIC, GTIA) and sound (POKEY) that were superior to most competitors. The hardware enabled fine scrolling, numerous sprites, and four-channel sound — capabilities that the Commodore 64 would not offer in comparable form until three years later.",
        "The Atari 8-bit family went through several iterations: from the original 400/800, through the cost-reduced XL models (600XL, 800XL, 1200XL), to the XE series (65XE, 130XE). The 130XE with 128 KB of RAM was particularly capable. The platform had a strong game library with titles like Star Raiders, M.U.L.E., Rescue on Fractalus!, and Alternate Reality.",
        "Although technically equal or superior to the Commodore 64, Atari lost the home computer war. Jack Tramiel's aggressive pricing after the takeover led to affordable prices but also reduced marketing and lack of software support. The Atari 8-bit computers still enjoy an active retro community to this day.",
      ],
      de: [
        "Die Atari-8-Bit-Computer waren ihrer Zeit in vielerlei Hinsicht voraus. Der Atari 800 erschien 1979 mit Custom-Chips für Grafik (ANTIC, GTIA) und Sound (POKEY), die den meisten Konkurrenten überlegen waren. Die Hardware ermöglichte feines Scrolling, viele Sprites und vierkanaligen Sound — Fähigkeiten, die der Commodore 64 erst drei Jahre später in ähnlicher Form bot.",
        "Die Atari-8-Bit-Familie durchlief mehrere Iterationen: vom originalen 400/800 über die kostenreduzierten XL-Modelle (600XL, 800XL, 1200XL) bis zur XE-Serie (65XE, 130XE). Der 130XE mit 128 KB RAM war besonders leistungsfähig. Die Plattform hatte eine starke Spielebibliothek mit Titeln wie Star Raiders, M.U.L.E., Rescue on Fractalus! und Alternate Reality.",
        "Obwohl technisch dem Commodore 64 ebenbürtig oder überlegen, verlor Atari den Heimcomputerkrieg. Jack Tramiels aggressive Preispolitik nach der Übernahme führte zwar zu günstigen Preisen, aber auch zu reduziertem Marketing und fehlender Softwareunterstützung. Die Atari-8-Bit-Computer haben bis heute eine aktive Retro-Community.",
      ],
    },
    facts: {
      unitsSold: "ca. 4 Millionen (alle Modelle)",
      cpu: "MOS 6502B (1,79 MHz)",
      gameLibrary: { en: "Thousands of games and programs", de: "Tausende Spiele und Programme" },
      launchPrice: "$999 (Atari 800, 1979)",
    },
    milestones: [
      { title: "Star Raiders", year: 1979, description: { en: "Revolutionary space simulator — often called the 'killer app' for the Atari 400/800", de: "Revolutionärer Weltraumsimulator — oft als 'Killerspiel' für den Atari 400/800 bezeichnet" } },
      { title: "M.U.L.E.", year: 1983, description: { en: "Legendary multiplayer economic game by Dani Bunten Berry", de: "Legendäres Mehrspieler-Wirtschaftsspiel von Dani Bunten Berry" } },
      { title: "Rescue on Fractalus!", year: 1984, description: { en: "By Lucasfilm Games — used fractal landscapes for revolutionary 3D graphics at the time", de: "Von Lucasfilm Games — nutzte fraktale Landschaften für damals revolutionäre 3D-Grafik" } },
    ],
  },
  {
    platformId: "lynx",
    manufacturer: "Atari",
    releaseYear: 1989,
    alternateNames: ["Atari Lynx", "Handy (Codename)"],
    history: {
      en: [
        "The Atari Lynx was the world's first handheld with a color display and offered technical capabilities that far surpassed the Game Boy. Developed by Epyx (the makers of California Games) and acquired by Atari, it could perform hardware scaling and rotation — effects otherwise found only in arcades. It was also the first handheld to support multiplayer for up to eight players via cable link.",
        "Yet the Lynx shared the same problems that would later afflict the Sega Game Gear: it was too large, too heavy, and devoured batteries. Six AA batteries lasted only four to five hours. Moreover, its price of $179.95 was significantly higher than the Game Boy's $89.99. The lack of third-party support and Atari's weak marketing did the rest.",
        "Only about 75 games were released for the Lynx, and the console sold fewer than one million units. Nevertheless, the Lynx enjoys cult status in retro gaming circles. Games like California Games, Blue Lightning, and Chip's Challenge demonstrated the hardware's potential, which was never fully exploited.",
      ],
      de: [
        "Der Atari Lynx war der weltweit erste Handheld mit Farbdisplay und bot technische Fähigkeiten, die den Game Boy weit übertrafen. Entwickelt von Epyx (den Machern von California Games) und von Atari übernommen, konnte er Hardware-Skalierung und -Rotation — Effekte, die sonst nur im Arcade-Bereich zu finden waren. Zudem war er der erste Handheld, der Multiplayer für bis zu acht Spieler über Kabelverbindung unterstützte.",
        "Doch der Lynx teilte die gleichen Probleme wie später der Sega Game Gear: Er war zu groß, zu schwer und fraß Batterien. Sechs AA-Batterien hielten nur vier bis fünf Stunden. Zudem war der Preis mit $179,95 deutlich höher als die $89,99 des Game Boy. Die mangelnde Drittanbieter-Unterstützung und Ataris schwaches Marketing taten ihr Übriges.",
        "Nur etwa 75 Spiele erschienen für den Lynx, und die Konsole verkaufte sich weniger als eine Million Mal. Trotzdem genießt der Lynx in Retro-Gaming-Kreisen einen Kultstatus. Spiele wie California Games, Blue Lightning und Chip's Challenge zeigten das Potenzial der Hardware, das nie voll ausgeschöpft wurde.",
      ],
    },
    facts: {
      unitsSold: "ca. 500.000-700.000",
      cpu: "MOS 65SC02 (4 MHz) + Custom Suzy (16 MHz)",
      gameLibrary: { en: "75 official games", de: "75 offizielle Spiele" },
      launchPrice: "$179,95 (1989)",
    },
    milestones: [
      { title: "California Games", year: 1989, description: { en: "Launch title that impressively demonstrated the color graphics and scaling capabilities", de: "Launch-Titel, der die Farbgrafik und Skalierungsfähigkeiten eindrucksvoll demonstrierte" } },
      { title: "Blue Lightning", year: 1989, description: { en: "Pseudo-3D flight game reminiscent of After Burner — technically impressive", de: "Pseudo-3D-Flugspiel, das an After Burner erinnerte — technisch beeindruckend" } },
      { title: "Chip's Challenge", year: 1989, description: { en: "Puzzle classic that was later ported to PC and became a cult hit there", de: "Puzzle-Klassiker, der später auf PC portiert und dort zum Kult wurde" } },
    ],
  },
  {
    platformId: "jaguar",
    manufacturer: "Atari",
    releaseYear: 1993,
    alternateNames: ["Atari Jaguar"],
    history: {
      en: [
        "The Atari Jaguar was Atari's last attempt to gain a foothold in the console market. Claiming to be the first '64-bit console,' Atari tried to position itself technically ahead of the competition. In truth, the 64-bit designation was marketing exaggeration — the Jaguar did have a 64-bit object processor but mainly used 32-bit data paths.",
        "The Jaguar's architecture was notoriously difficult to program. The hardware consisted of five processors that had to be coordinated — a challenge that even experienced developers struggled with. Most games used the slower Motorola 68000 processor as the main CPU out of convenience, rather than leveraging the more powerful Tom and Jerry chips to their full potential.",
        "The result was a thin game library with few highlights. Tempest 2000 by Jeff Minter is considered a masterpiece, and Alien vs. Predator was an impressive first-person shooter. But most titles could not compete with the emerging PlayStation and Saturn. With only around 250,000 units sold, the Jaguar was a commercial disaster that definitively ended Atari's console business.",
      ],
      de: [
        "Der Atari Jaguar war Ataris letzter Versuch, im Konsolenmarkt Fuß zu fassen. Mit der Behauptung, die erste '64-Bit-Konsole' zu sein, versuchte Atari, sich technisch vor der Konkurrenz zu positionieren. In Wahrheit war die 64-Bit-Bezeichnung Marketing-Übertreibung — der Jaguar hatte zwar einen 64-Bit-Objektprozessor, nutzte aber hauptsächlich 32-Bit-Pfade.",
        "Die Architektur des Jaguar war notorisch schwer zu programmieren. Die Hardware bestand aus fünf Prozessoren, die koordiniert werden mussten — eine Herausforderung, an der selbst erfahrene Entwickler scheiterten. Die meisten Spiele nutzten aus Bequemlichkeit den langsameren Motorola-68000-Prozessor als Hauptprozessor, anstatt die leistungsfähigeren Tom- und Jerry-Chips auszureizen.",
        "Das Ergebnis war eine dünne Spielebibliothek mit wenigen Highlights. Tempest 2000 von Jeff Minter gilt als Meisterwerk, und Alien vs. Predator war ein beeindruckender Ego-Shooter. Doch die meisten Titel konnten nicht mit der aufkommenden PlayStation und dem Saturn mithalten. Mit nur 125.000 verkauften Einheiten vor dem Atari Jaguar CD war der Jaguar ein kommerzielles Desaster, das Ataris Konsolengeschäft endgültig beendete.",
      ],
    },
    facts: {
      unitsSold: "ca. 250.000",
      cpu: "Motorola 68000 (13,3 MHz) + Tom/Jerry-Coprozessoren",
      gameLibrary: { en: "50 official games", de: "50 offizielle Spiele" },
      launchPrice: "$249,99 (1993)",
    },
    milestones: [
      { title: "Tempest 2000", year: 1994, description: { en: "Jeff Minter's psychedelic masterpiece — the best game for the Jaguar", de: "Jeff Minters psychedelisches Meisterwerk — das beste Spiel für den Jaguar" } },
      { title: "Alien vs. Predator", year: 1994, description: { en: "Atmospheric first-person shooter that hinted at the hardware's potential", de: "Atmosphärischer Ego-Shooter, der das Potenzial der Hardware andeutete" } },
      { title: "Doom (Jaguar)", year: 1994, description: { en: "Praised by John Carmack as the best console port of Doom", de: "Von John Carmack als beste Konsolen-Portierung von Doom gelobt" } },
    ],
  },
  {
    platformId: "jaguarcd",
    manufacturer: "Atari",
    releaseYear: 1995,
    alternateNames: ["Atari Jaguar CD"],
    history: {
      en: [
        "The Atari Jaguar CD was a CD-ROM add-on for the already failing Jaguar. It launched in 1995, when the PlayStation and Saturn were already dominating the market. Atari hoped to extend the Jaguar's lifespan with the peripheral and give developers more storage space for larger games.",
        "The reality was sobering. The Jaguar CD had massive reliability problems — the drive was prone to errors, and many units failed early. The game library was tiny with only 13 official titles. Some of them, like Myst and Battlemorph, were solid, but there were no exclusive titles compelling enough to justify the purchase.",
        "The Jaguar CD is considered one of the biggest flops in video game history. It marked the definitive end of Atari's console business. After the failure, Atari merged with JTS Corporation, and the brand changed owners multiple times in the following years. Today, the Jaguar CD is a rare collector's item.",
      ],
      de: [
        "Das Atari Jaguar CD war ein CD-ROM-Aufsatz für den ohnehin schon scheiternden Jaguar. Es erschien 1995, als die PlayStation und der Saturn den Markt bereits dominierten. Atari hoffte, mit dem Zusatzgerät die Lebensdauer des Jaguar zu verlängern und Entwicklern mehr Speicherplatz für umfangreichere Spiele zu bieten.",
        "Die Realität war ernüchternd. Das Jaguar CD hatte massive Zuverlässigkeitsprobleme — das Laufwerk war anfällig für Fehler, und viele Einheiten fielen früh aus. Die Spielebibliothek war mit nur 13 offiziellen Titeln winzig. Einige davon, wie Myst und Baldur's Gate: Dark Alliance, waren solide Portierungen, aber es fehlte an exklusiven Titeln, die den Kauf rechtfertigten.",
        "Das Jaguar CD gilt als einer der größten Flops der Videospielgeschichte. Es markierte das endgültige Ende von Ataris Konsolengeschäft. Nach dem Misserfolg fusionierte Atari mit JTS Corporation, und die Marke wechselte in den folgenden Jahren mehrfach den Besitzer. Heute ist das Jaguar CD ein seltenes Sammlerstück.",
      ],
    },
    facts: {
      unitsSold: "ca. 20.000",
      cpu: "Wie Jaguar (CD-Erweiterung)",
      gameLibrary: { en: "13 official games", de: "13 offizielle Spiele" },
      launchPrice: "$149,95 (1995)",
    },
    milestones: [
      { title: "Myst", year: 1995, description: { en: "Port of the PC bestseller — one of the few reasons to buy the Jaguar CD", de: "Portierung des PC-Bestsellers — einer der wenigen Gründe, das Jaguar CD zu kaufen" } },
      { title: "Highlander: The Last of the MacLeods", year: 1995, description: { en: "FMV-heavy adventure based on the animated series", de: "FMV-lastiges Adventure basierend auf der Zeichentrickserie" } },
      { title: "Blue Lightning (Jaguar CD)", year: 1995, description: { en: "Reworked version of the Lynx classic with CD-quality audio", de: "Überarbeitete Version des Lynx-Klassikers mit CD-Qualitäts-Audio" } },
    ],
  },
  {
    platformId: "atarist",
    manufacturer: "Atari",
    releaseYear: 1985,
    alternateNames: ["Atari ST", "Atari 520ST", "Atari 1040ST", "Jackintosh"],
    history: {
      en: [
        "The Atari ST was Jack Tramiel's revenge on Commodore. After Tramiel left Commodore and took over Atari, he released a 16-bit computer within a year that significantly undercut the Amiga on price. The nickname 'Jackintosh' referred to its similarity to the Macintosh — the ST offered a graphical user interface (GEM) at a fraction of the Mac's price.",
        "The Atari ST became legendary especially in the music world. It was the first affordable computer with a built-in MIDI interface, making it the standard in recording studios. Fatboy Slim, The Prodigy, and countless other musicians used the ST for their productions. Software like Cubase (by Steinberg) had its origins on the Atari ST.",
        "As a gaming platform, the ST was particularly successful in Europe, especially in Germany and France. It shared most of its game library with the Amiga, though the Amiga usually had the edge in graphics and sound. The ST, however, often offered faster processor performance, which benefited CPU-intensive games. Dungeon Master, a milestone of the RPG genre, debuted on the Atari ST.",
      ],
      de: [
        "Der Atari ST war Jack Tramiels Rache an Commodore. Nachdem Tramiel Commodore verlassen und Atari übernommen hatte, brachte er innerhalb eines Jahres einen 16-Bit-Computer heraus, der den Amiga preislich deutlich unterbot. Der Spitzname 'Jackintosh' verwies auf die Ähnlichkeit mit dem Macintosh — der ST bot eine grafische Benutzeroberfläche (GEM) zu einem Bruchteil des Mac-Preises.",
        "Besonders im Musikbereich wurde der Atari ST legendär. Er war der erste bezahlbare Computer mit eingebauter MIDI-Schnittstelle, was ihn zum Standard in Tonstudios machte. Fatboy Slim, The Prodigy und unzählige andere Musiker nutzten den ST für ihre Produktionen. Software wie Cubase (von Steinberg) hatte ihren Ursprung auf dem Atari ST.",
        "Als Spieleplattform war der ST vor allem in Europa erfolgreich, besonders in Deutschland und Frankreich. Die Spielebibliothek teilte er sich größtenteils mit dem Amiga, wobei der Amiga bei Grafik und Sound meist die Nase vorn hatte. Der ST bot jedoch oft schnellere Prozessorleistung, was CPU-intensive Spiele begünstigte. Dungeon Master, ein Meilenstein des RPG-Genres, erschien zuerst auf dem Atari ST.",
      ],
    },
    facts: {
      unitsSold: "ca. 6 Millionen",
      cpu: "Motorola 68000 (8 MHz)",
      gameLibrary: { en: "2,500+ games", de: "2.500+ Spiele" },
      launchPrice: "$799,99 (520ST, 1985)",
    },
    milestones: [
      { title: "Dungeon Master", year: 1987, description: { en: "Revolutionary real-time RPG that debuted on the ST and shaped the genre", de: "Revolutionäres Echtzeit-RPG, das zuerst auf dem ST erschien und das Genre prägte" } },
      { title: "Cubase (Steinberg)", year: 1989, description: { en: "Music software that made the ST a studio standard — still exists today", de: "Musiksoftware, die den ST zum Studio-Standard machte — existiert bis heute" } },
      { title: "Enchanted Land", year: 1990, description: { en: "Technically impressive platformer that demonstrated the ST's capabilities", de: "Technisch beeindruckender Plattformer, der die Fähigkeiten des ST demonstrierte" } },
    ],
  },

  // ── NEC ──
  {
    platformId: "pcengine",
    manufacturer: "NEC / Hudson Soft",
    releaseYear: 1987,
    alternateNames: ["PC Engine (Japan)", "TurboGrafx-16 (Nordamerika)", "CoreGrafx"],
    history: {
      en: [
        "The PC Engine, known as TurboGrafx-16 in North America, was one of the most innovative consoles of the late 1980s. Developed by Hudson Soft and marketed by NEC, it was the first console with an optional CD-ROM drive (CD-ROM2) — years before Sony or Sega took that step. In Japan, the PC Engine was an enormous success and temporarily displaced Nintendo's Famicom from second place.",
        "The hardware was cleverly designed: an 8-bit main processor was paired with a powerful 16-bit graphics processor capable of displaying up to 512 colors simultaneously. The HuCard cartridges were credit-card-sized — elegant and space-saving. The CD-ROM2 system enabled CD-quality music, voice acting, and larger game worlds.",
        "In North America, however, the TurboGrafx-16 failed against the overpowering duo of Nintendo and Sega. The marketing was inadequate, and Sega's aggressive 'Genesis does what Nintendon't' campaign left little room for a third competitor. Nevertheless, the PC Engine remains a beloved platform for collectors, especially the Japanese CD-ROM2 titles like Castlevania: Rondo of Blood and Ys Book I & II.",
      ],
      de: [
        "Die PC Engine, in Nordamerika als TurboGrafx-16 bekannt, war eine der innovativsten Konsolen der späten 80er Jahre. Entwickelt von Hudson Soft und vermarktet von NEC, war sie die erste Konsole mit einem optionalen CD-ROM-Laufwerk (CD-ROM2) — Jahre bevor Sony oder Sega diesen Schritt wagten. In Japan war die PC Engine ein enormer Erfolg und verdrängte zeitweise Nintendos Famicom vom zweiten Platz.",
        "Die Hardware war clever konzipiert: Ein 8-Bit-Hauptprozessor wurde mit einem leistungsfähigen 16-Bit-Grafikprozessor kombiniert, der bis zu 512 Farben gleichzeitig darstellen konnte. Die HuCard-Module waren kreditkartengroß — elegant und platzsparend. Das CD-ROM2-System ermöglichte CD-Qualitäts-Musik, Sprachausgabe und größere Spielwelten.",
        "In Nordamerika scheiterte die TurboGrafx-16 jedoch am übermächtigen Duo aus Nintendo und Sega. Das Marketing war unzureichend, und die aggressive 'Genesis does what Nintendon't'-Kampagne von Sega ließ wenig Raum für einen dritten Konkurrenten. Trotzdem bleibt die PC Engine eine Lieblingsplattform für Sammler, besonders die japanischen CD-ROM2-Titel wie Castlevania: Rondo of Blood und Ys Book I & II.",
      ],
    },
    facts: {
      unitsSold: "10 Millionen (geschätzt, alle Varianten)",
      cpu: "HuC6280 (7,16 MHz)",
      gameLibrary: { en: "686 official games (incl. CD-ROM2)", de: "686 offizielle Spiele (inkl. CD-ROM2)" },
      launchPrice: "24.800 Yen / $199 (1989)",
    },
    milestones: [
      { title: "Castlevania: Rondo of Blood", year: 1993, description: { en: "One of the best action-platformers of all time — long a Japan exclusive on the PC Engine", de: "Eines der besten Action-Plattformer aller Zeiten — lange Japan-exklusiv auf der PC Engine" } },
      { title: "Ys Book I & II", year: 1989, description: { en: "CD-ROM showcase with orchestral music and voice acting — an RPG milestone", de: "CD-ROM-Showcase mit orchestraler Musik und Sprachausgabe — ein RPG-Meilenstein" } },
      { title: "Bonk's Adventure", year: 1989, description: { en: "Mascot platformer that became the face of the TurboGrafx-16", de: "Maskottchen-Plattformer, der zum Gesicht der TurboGrafx-16 wurde" } },
      { title: "R-Type (HuCard)", year: 1988, description: { en: "Outstanding arcade port that established the PC Engine as a shoot-'em-up machine", de: "Herausragende Arcade-Portierung, die die PC Engine als Shoot'em'up-Maschine etablierte" } },
      { title: "Blazing Lazers", year: 1989, description: { en: "By Hudson Soft and Compile — one of the best shoot-'em-ups of the 8/16-bit era", de: "Von Hudson Soft und Compile — einer der besten Shoot'em'ups der 8-/16-Bit-Ära" } },
    ],
  },
  {
    platformId: "pcfx",
    manufacturer: "NEC",
    releaseYear: 1994,
    alternateNames: ["PC-FX"],
    history: {
      en: [
        "The PC-FX was NEC's successor to the successful PC Engine — and one of the most peculiar consoles of the 1990s. Instead of focusing on 3D graphics as the PlayStation and Saturn did, NEC concentrated on 2D graphics and full-motion video (FMV). The console was essentially a specialized FMV machine with outstanding 2D capabilities but no 3D acceleration whatsoever.",
        "This decision proved fatal. While the world marveled at 3D polygon games like Virtua Fighter and Ridge Racer, the PC-FX mainly offered anime visual novels and 2D games. The target audience narrowed to anime fans in Japan — a niche market that was not enough to keep the console alive.",
        "The PC-FX was never released outside Japan and sold only around 100,000 units. It marked the end of NEC's console business. Nevertheless, it has a small but loyal fan base among collectors of Japanese niche games and anime visual novels.",
      ],
      de: [
        "Die PC-FX war NECs Nachfolger der erfolgreichen PC Engine — und eine der merkwürdigsten Konsolen der 90er Jahre. Statt auf 3D-Grafik zu setzen, wie es PlayStation und Saturn taten, konzentrierte sich NEC auf 2D-Grafik und Full-Motion-Video (FMV). Die Konsole war im Grunde eine spezialisierte FMV-Maschine mit herausragender 2D-Fähigkeit, aber ohne jegliche 3D-Beschleunigung.",
        "Diese Entscheidung erwies sich als fatal. Während die Welt 3D-Polygon-Spiele wie Virtua Fighter und Ridge Racer bestaunte, bot die PC-FX hauptsächlich Anime-Visual-Novels und 2D-Spiele. Die Zielgruppe verengte sich auf Anime-Fans in Japan — ein Nischenmarkt, der nicht ausreichte, um die Konsole am Leben zu halten.",
        "Die PC-FX wurde nie außerhalb Japans veröffentlicht und verkaufte sich nur rund 100.000 Mal. Sie markierte das Ende von NECs Konsolengeschäft. Trotzdem hat sie eine kleine, aber treue Fangemeinde unter Sammlern japanischer Nischenspiele und Anime-Visual-Novels.",
      ],
    },
    facts: {
      unitsSold: "ca. 100.000",
      cpu: "NEC V810 (21,5 MHz)",
      gameLibrary: { en: "62 official games", de: "62 offizielle Spiele" },
      launchPrice: "49.800 Yen (1994)",
    },
    milestones: [
      { title: "Tengai Makyou: The Apocalypse IV", year: 1995, description: { en: "Ambitious RPG and best-selling PC-FX game", de: "Ambitioniertes RPG und meistverkauftes PC-FX-Spiel" } },
      { title: "Chip-Chan Kick!", year: 1996, description: { en: "Charming action-platformer that leveraged the hardware's 2D strengths", de: "Charmanter Action-Plattformer, der die 2D-Stärken der Hardware nutzte" } },
      { title: "Anime Freak FX Vol. 1", year: 1995, description: { en: "Example of the platform's anime FMV orientation", de: "Beispiel für die Anime-FMV-Ausrichtung der Plattform" } },
    ],
  },

  // ── SNK ──
  {
    platformId: "neogeo",
    manufacturer: "SNK",
    releaseYear: 1990,
    alternateNames: ["Neo Geo AES", "Neo Geo MVS (Arcade)"],
    history: {
      en: [
        "The Neo Geo was a unique concept: identical hardware for arcades (MVS — Multi Video System) and for home use (AES — Advanced Entertainment System). For the first time, players could play exactly the same arcade games at home — with no compromises in graphics or gameplay. The catch: the price. The AES console cost $649.99, and individual games ran $200 to $300.",
        "This astronomical price made the Neo Geo a luxury object — the 'Rolls Royce of game consoles,' as the advertising proclaimed. The target audience was affluent enthusiasts and arcade fanatics willing to pay for the ultimate gaming experience. In Japan, Neo Geo cabinets were found in every arcade, and the MVS dominated the arcade market throughout the 1990s.",
        "SNK's game library specialized in fighting games and shoot-'em-ups. The King of Fighters, Fatal Fury, Samurai Shodown, and Art of Fighting defined the 2D fighting game era. Metal Slug set the standard for run-and-gun action. The Neo Geo's pixel art is still considered the pinnacle of 2D graphics — games like Garou: Mark of the Wolves look fantastic even 25 years after release.",
      ],
      de: [
        "Das Neo Geo war ein einzigartiges Konzept: identische Hardware für Spielhallen (MVS — Multi Video System) und für zuhause (AES — Advanced Entertainment System). Zum ersten Mal konnten Spieler exakt die gleichen Arcade-Spiele zuhause spielen — ohne Kompromisse bei Grafik oder Gameplay. Der Haken: Der Preis. Die AES-Konsole kostete $649,99, und einzelne Spiele lagen bei $200-$300.",
        "Dieser astronomische Preis machte das Neo Geo zum Luxus-Objekt — zum 'Rolls Royce der Spielkonsolen', wie es in der Werbung hieß. Die Zielgruppe waren wohlhabende Enthusiasten und Arcade-Fanatiker, die bereit waren, für die ultimative Spielerfahrung zu zahlen. In Japan waren Neo-Geo-Automaten in jeder Spielhalle zu finden, und der MVS dominierte den Arcade-Markt der 90er Jahre.",
        "SNKs Spielebibliothek war spezialisiert auf Kampfspiele und Shoot'em'ups. The King of Fighters, Fatal Fury, Samurai Shodown und Art of Fighting definierten die 2D-Kampfspiel-Ära. Metal Slug setzte Maßstäbe für Run'n'Gun-Action. Die Pixel-Art des Neo Geo gilt bis heute als Höhepunkt der 2D-Grafik — Spiele wie Garou: Mark of the Wolves sehen auch 25 Jahre nach Erscheinen noch fantastisch aus.",
      ],
    },
    facts: {
      unitsSold: "ca. 1 Million (AES)",
      cpu: "Motorola 68000 (12 MHz) + Zilog Z80A (4 MHz)",
      gameLibrary: { en: "148 official AES games", de: "148 offizielle AES-Spiele" },
      launchPrice: "$649,99 (AES, 1990)",
    },
    milestones: [
      { title: "The King of Fighters '98", year: 1998, description: { en: "Considered one of the best 2D fighters of all time — perfectly balanced", de: "Gilt als einer der besten 2D-Kämpfer aller Zeiten — perfekt ausbalanciert" } },
      { title: "Metal Slug", year: 1996, description: { en: "Masterpiece of pixel art and the run-and-gun genre — unsurpassed in detail", de: "Meisterwerk der Pixel-Art und des Run'n'Gun-Genres — unübertroffen in Detailreichtum" } },
      { title: "Samurai Shodown II", year: 1994, description: { en: "Weapon-based fighting game with unique pacing and dramatic battles", de: "Waffen-basiertes Kampfspiel mit einzigartigem Tempo und dramatischen Kämpfen" } },
      { title: "Garou: Mark of the Wolves", year: 1999, description: { en: "SNK's masterpiece — breathtaking animation and deep fighting system", de: "SNKs Meisterwerk — atemberaubende Animation und tiefes Kampfsystem" } },
      { title: "Last Blade 2", year: 1998, description: { en: "Elegant fighting game set in feudal Japan with beautiful art style", de: "Elegantes Kampfspiel im feudalen Japan mit wunderschönem Kunststil" } },
    ],
  },
  {
    platformId: "neogeocd",
    manufacturer: "SNK",
    releaseYear: 1994,
    alternateNames: ["Neo Geo CD", "NGCD"],
    history: {
      en: [
        "The Neo Geo CD was SNK's attempt to replace the prohibitively expensive AES cartridges with cheaper CDs. Games cost only a fraction of the AES cartridges — between $49 and $79 instead of $200 to $300. For many fans, this was finally an affordable way into the Neo Geo library.",
        "The big problem: the loading times. The front-loading CD drive with only single-speed read capability led to loading times of sometimes several minutes between fights. In a genre that depended on speed and flow, this was unacceptable. SNK tried to counter this with the Neo Geo CDZ (double-speed reading), but even that was not enough.",
        "Despite the loading time issues, the Neo Geo CD offers some exclusive advantages: enhanced soundtracks in CD quality, additional animations, and occasionally exclusive content. For collectors, the NGCD is attractive today since the games are significantly cheaper than the AES cartridges, which can cost thousands of euros.",
      ],
      de: [
        "Das Neo Geo CD war SNKs Versuch, die prohibitiv teuren AES-Module durch günstigere CDs zu ersetzen. Die Spiele kosteten nur einen Bruchteil der AES-Module — zwischen $49 und $79 statt $200-$300. Für viele Fans war dies endlich der bezahlbare Zugang zur Neo-Geo-Bibliothek.",
        "Das große Problem: die Ladezeiten. Das Frontloading-CD-Laufwerk mit nur einfacher Lesegeschwindigkeit führte zu teilweise minutenlangen Ladezeiten zwischen Kämpfen. In einem Genre, das auf Geschwindigkeit und Fluss angewiesen war, war dies inakzeptabel. SNK versuchte mit dem Neo Geo CDZ (doppelte Lesegeschwindigkeit) gegenzusteuern, doch auch dies reichte nicht.",
        "Trotz der Ladezeiten-Problematik bietet das Neo Geo CD einige exklusive Vorzüge: erweiterte Soundtracks auf CD-Qualität, zusätzliche Animationen und gelegentlich exklusive Inhalte. Für Sammler ist das NGCD heute attraktiv, da die Spiele deutlich günstiger sind als die AES-Module, die teilweise tausende Euro kosten.",
      ],
    },
    facts: {
      unitsSold: "ca. 570.000",
      cpu: "Motorola 68000 (12 MHz) + Zilog Z80A (4 MHz)",
      gameLibrary: { en: "98 official games", de: "98 offizielle Spiele" },
      launchPrice: "49.800 Yen / $299 (1994)",
    },
    milestones: [
      { title: "Samurai Shodown RPG", year: 1997, description: { en: "Exclusive RPG based on the popular fighting game series", de: "Exklusives RPG auf Basis der beliebten Kampfspiel-Serie" } },
      { title: "The King of Fighters '96", year: 1996, description: { en: "One of the first KOF titles with a CD-quality soundtrack", de: "Einer der ersten KOF-Titel mit CD-Qualitäts-Soundtrack" } },
      { title: "Neo Geo CDZ", year: 1995, description: { en: "Revised model with double CD read speed", de: "Überarbeitetes Modell mit doppelter CD-Lesegeschwindigkeit" } },
    ],
  },
  {
    platformId: "ngp",
    manufacturer: "SNK",
    releaseYear: 1998,
    alternateNames: ["Neo Geo Pocket", "NGP"],
    history: {
      en: [
        "The Neo Geo Pocket was SNK's first foray into the handheld market — a monochrome handheld that appeared just six months before its color successor. It was primarily sold in Japan and offered impressive game quality despite the monochrome display, particularly in its fighting games.",
        "The design was ergonomically well thought out, and the microswitch joystick provided an outstanding control feel — especially for fighting games, this was an enormous advantage over the Game Boy. The hardware was based on a Toshiba TLCS-900H processor and delivered smooth animations despite the monochrome display.",
        "The NGP was quickly superseded by the Neo Geo Pocket Color and had only a brief lifespan on the market. The few published titles are rare collector's items today. SNK had tested the market with the monochrome model before the improved color version followed.",
      ],
      de: [
        "Der Neo Geo Pocket war SNKs erster Vorstoß in den Handheld-Markt — ein monochromer Handheld, der nur sechs Monate vor dem farbigen Nachfolger erschien. Er wurde hauptsächlich in Japan verkauft und bot trotz des monochromen Displays eine beeindruckende Spielequalität, insbesondere bei den Kampfspielen.",
        "Das Design war ergonomisch durchdacht und der Mikroswitch-Joystick bot ein herausragendes Steuerungsgefühl — besonders für Kampfspiele war dies ein enormer Vorteil gegenüber dem Game Boy. Die Hardware basierte auf einem Toshiba-TLCS-900H-Prozessor und bot trotz des monochromen Displays flüssige Animationen.",
        "Der NGP wurde schnell vom Neo Geo Pocket Color abgelöst und hatte nur eine kurze Lebensdauer auf dem Markt. Die wenigen veröffentlichten Titel sind heute seltene Sammlerstücke. SNK hatte mit dem monochromen Modell den Markt getestet, bevor die verbesserte Farbversion folgte.",
      ],
    },
    facts: {
      unitsSold: "Begrenzt (schnell durch NGPC ersetzt)",
      cpu: "Toshiba TLCS-900H (6,144 MHz) + Zilog Z80 (3,072 MHz)",
      gameLibrary: { en: "10 games (Japan-exclusive)", de: "10 Spiele (Japan-exklusiv)" },
      launchPrice: "7.800 Yen (1998)",
    },
    milestones: [
      { title: "King of Fighters R-1", year: 1998, description: { en: "Impressive handheld adaptation of the popular fighting game series", de: "Beeindruckende Handheld-Umsetzung der beliebten Kampfspiel-Serie" } },
      { title: "Melon-Chan's Growth Diary", year: 1998, description: { en: "Virtual pet game as a launch title", de: "Virtuelles Haustier-Spiel als Launch-Titel" } },
      { title: "Neo Geo Pocket Color Ankündigung", year: 1999, description: { en: "The color version quickly became the actual focus of SNK's handheld strategy", de: "Farbversion wurde schnell zum eigentlichen Fokus von SNKs Handheld-Strategie" } },
    ],
  },
  {
    platformId: "ngpc",
    manufacturer: "SNK",
    releaseYear: 1999,
    alternateNames: ["Neo Geo Pocket Color", "NGPC"],
    history: {
      en: [
        "The Neo Geo Pocket Color was SNK's masterpiece in the handheld space — a small, elegant device with an outstanding microswitch joystick that made fighting games on a handheld a joy. In Japan and among fighting game enthusiasts, the NGPC was held in high regard.",
        "The game library was small but of exceptionally high quality. SNK vs. Capcom: Match of the Millennium is considered one of the best handheld fighting games ever made. Sonic the Hedgehog Pocket Adventure offered an excellent Sonic experience. Card Fighters Clash was an addictive trading card game. SNK even forged a partnership with Capcom for crossover titles.",
        "Despite its quality, the NGPC could not stand against Nintendo's overpowering Game Boy Color. When SNK filed for bankruptcy in October 2000, the NGPC was pulled from the market. In North America, it had survived less than two years. Today it is a sought-after collector's item, and its games fetch high prices — especially the English-language versions.",
      ],
      de: [
        "Der Neo Geo Pocket Color war SNKs Meisterstück im Handheld-Bereich — ein kleines, elegantes Gerät mit einem herausragenden Mikroswitch-Joystick, der Kampfspiele auf dem Handheld zur Freude machte. In Japan und unter Kampfspiel-Enthusiasten genoss der NGPC hohes Ansehen.",
        "Die Spielebibliothek war zwar klein, aber qualitativ hochwertig. SNK vs. Capcom: Match of the Millennium gilt als eines der besten Handheld-Kampfspiele überhaupt. Sonic the Hedgehog Pocket Adventure bot ein exzellentes Sonic-Erlebnis. Card Fighters Clash war ein suchterzeugendes Sammelkartenspiel. SNK schloss sogar eine Kooperation mit Capcom für Crossover-Titel.",
        "Trotz der Qualität konnte der NGPC nicht gegen Nintendos übermächtigen Game Boy Color bestehen. Als SNK im Oktober 2000 Insolvenz anmeldete, wurde der NGPC vom Markt genommen. In Nordamerika hatte er weniger als zwei Jahre überlebt. Heute ist er ein begehrtes Sammlerstück, und seine Spiele erzielen hohe Preise — besonders die englischsprachigen Versionen.",
      ],
    },
    facts: {
      unitsSold: "ca. 2 Millionen",
      cpu: "Toshiba TLCS-900H (6,144 MHz) + Zilog Z80 (3,072 MHz)",
      gameLibrary: { en: "82 official games", de: "82 offizielle Spiele" },
      launchPrice: "8.900 Yen / $69,95 (1999)",
    },
    milestones: [
      { title: "SNK vs. Capcom: Match of the Millennium", year: 1999, description: { en: "One of the best handheld fighting games of all time with a huge roster", de: "Eines der besten Handheld-Kampfspiele aller Zeiten mit riesigem Roster" } },
      { title: "Sonic the Hedgehog Pocket Adventure", year: 1999, description: { en: "Excellent Sonic game exclusive to the NGPC", de: "Exzellentes Sonic-Spiel exklusiv für den NGPC" } },
      { title: "Card Fighters Clash", year: 1999, description: { en: "Brilliant SNK vs. Capcom card game spin-off with high addictiveness", de: "Genialer SNK-vs.-Capcom-Kartenspiel-Ableger mit hohem Suchtfaktor" } },
      { title: "Metal Slug: 1st Mission", year: 1999, description: { en: "Run-and-gun action in pocket format with surprising depth", de: "Run'n'Gun-Action im Taschenformat mit überraschender Spieltiefe" } },
    ],
  },

  // ── Bandai ──
  {
    platformId: "wonderswan",
    manufacturer: "Bandai",
    releaseYear: 1999,
    alternateNames: ["WonderSwan", "WS"],
    history: {
      en: [
        "The WonderSwan was the final project of Gunpei Yokoi, the legendary Game Boy inventor who had left Nintendo in 1996 after the Virtual Boy debacle. Yokoi founded Koto Laboratory and designed for Bandai a handheld that continued his philosophy of 'lateral thinking with withered technology.' Tragically, Yokoi died in a car accident in 1997 before the WonderSwan was completed.",
        "The WonderSwan was affordable (only 4,800 yen), compact, and offered innovative features such as the ability to play both horizontally and vertically — ideal for different game genres. It ran on just a single AA battery for up to 30 hours. In Japan, it briefly captured up to 8% market share thanks to licensing deals with Square (Final Fantasy I-IV remakes) and Bandai's own anime catalog.",
        "Outside Japan, the WonderSwan was never released. Competition from the Game Boy Advance starting in 2001 ended its lifecycle early. Nevertheless, the WonderSwan is a worthy legacy for Gunpei Yokoi — an elegant, thoughtfully designed device that carried on the spirit of the Game Boy in a new form.",
      ],
      de: [
        "Der WonderSwan war das letzte Projekt von Gunpei Yokoi, dem legendären Game-Boy-Erfinder, der 1996 nach dem Virtual-Boy-Debakel Nintendo verlassen hatte. Yokoi gründete Koto Laboratory und entwarf für Bandai einen Handheld, der seine 'Laterales Denken mit veralteter Technologie'-Philosophie fortsetzte. Tragischerweise starb Yokoi 1997 bei einem Autounfall, bevor der WonderSwan fertiggestellt wurde.",
        "Der WonderSwan war günstig (nur 4.800 Yen), kompakt und bot innovative Features wie die Möglichkeit, sowohl horizontal als auch vertikal zu spielen — ideal für verschiedene Spielgenres. Er lief mit nur einer AA-Batterie für bis zu 30 Stunden. In Japan konnte er dank Lizenzdeals mit Square (Final Fantasy I-IV Remakes) und Bandais eigenem Anime-Katalog kurzzeitig bis zu 8% Marktanteil erobern.",
        "Außerhalb Japans wurde der WonderSwan nie veröffentlicht. Die Konkurrenz durch den Game Boy Advance ab 2001 beendete seinen Lebenszyklus früh. Trotzdem ist der WonderSwan ein würdiges Vermächtnis für Gunpei Yokoi — ein elegantes, durchdachtes Gerät, das den Geist des Game Boy in einer neuen Form weiterführte.",
      ],
    },
    facts: {
      unitsSold: "3,5 Millionen (inkl. Color/Crystal)",
      cpu: "NEC V30 MZ (3,072 MHz)",
      gameLibrary: { en: "109 official games", de: "109 offizielle Spiele" },
      launchPrice: "4.800 Yen (1999)",
    },
    milestones: [
      { title: "Final Fantasy (WS-Remake)", year: 2000, description: { en: "Square remake that positioned the WonderSwan as an RPG handheld", de: "Square-Remake, das den WonderSwan als RPG-Handheld positionierte" } },
      { title: "Gunpey", year: 1999, description: { en: "Puzzle game named after Gunpei Yokoi — a worthy tribute to the creator", de: "Puzzle-Spiel benannt nach Gunpei Yokoi — ein würdiges Tribut an den Schöpfer" } },
      { title: "Digimon", year: 1999, description: { en: "Licensed games that benefited from Bandai's anime catalog", de: "Lizenzspiele, die von Bandais Anime-Katalog profitierten" } },
    ],
  },
  {
    platformId: "wsc",
    manufacturer: "Bandai",
    releaseYear: 2000,
    alternateNames: ["WonderSwan Color", "WSC", "SwanCrystal"],
    history: {
      en: [
        "The WonderSwan Color was the logical evolution of the original WonderSwan — a color screen displaying 241 simultaneous colors from a palette of 4,096. As with its predecessor, full backward compatibility was maintained, and the device still required only a single AA battery for up to 20 hours of play time.",
        "The biggest titles for the WSC again came from Square: Final Fantasy II and IV received excellent color remakes, and Romancing SaGa also appeared on the platform. The WSC fought its way to a respectable market share in Japan against the Game Boy Color — but the announcement of the Game Boy Advance changed everything.",
        "In 2002, the final revision appeared, the SwanCrystal, with an improved TFT display. But against the technically superior GBA, it too stood no chance. The WonderSwan Color/Crystal marked the end of Bandai's handheld ambitions. The platform remains an insider tip for collectors of Japanese handhelds with some excellent titles.",
      ],
      de: [
        "Der WonderSwan Color war die konsequente Weiterentwicklung des originalen WonderSwan — ein Farbbildschirm mit 241 gleichzeitig darstellbaren Farben aus einer Palette von 4.096. Wie beim Vorgänger blieb die volle Abwärtskompatibilität erhalten, und das Gerät benötigt weiterhin nur eine einzige AA-Batterie für bis zu 20 Stunden Spielzeit.",
        "Die größten Titel des WSC kamen erneut von Square: Final Fantasy II und IV erhielten hervorragende Farbremakes, und Romancing SaGa erschien ebenfalls auf der Plattform. Der WSC erkämpfte sich in Japan einen respektablen Marktanteil gegen den Game Boy Color — doch die Ankündigung des Game Boy Advance veränderte alles.",
        "2002 erschien die letzte Revision, der SwanCrystal, mit einem verbesserten TFT-Display. Doch gegen den technisch überlegenen GBA hatte auch er keine Chance. Der WonderSwan Color/Crystal markierte das Ende von Bandais Handheld-Ambitionen. Die Plattform bleibt ein Geheimtipp für Sammler japanischer Handhelds mit einigen exzellenten Titeln.",
      ],
    },
    facts: {
      unitsSold: "Im Gesamtverkauf von 3,5 Mio. enthalten",
      cpu: "NEC V30 MZ (3,072 MHz)",
      gameLibrary: { en: "91 official games", de: "91 offizielle Spiele" },
      launchPrice: "6.800 Yen (2000)",
    },
    milestones: [
      { title: "Final Fantasy IV (WSC-Remake)", year: 2002, description: { en: "Well-done color remake of the SNES classic", de: "Gelungenes Farbremake des SNES-Klassikers" } },
      { title: "Riviera: The Promised Land", year: 2002, description: { en: "Tactical RPG by Sting, later ported to GBA", de: "Taktik-RPG von Sting, das später auf GBA portiert wurde" } },
      { title: "SwanCrystal", year: 2002, description: { en: "Final hardware revision with improved TFT display and elegant design", de: "Letzte Hardware-Revision mit verbessertem TFT-Display und elegantem Design" } },
    ],
  },

  // ── Other Consoles ──
  {
    platformId: "3do",
    manufacturer: "The 3DO Company (Trip Hawkins)",
    releaseYear: 1993,
    alternateNames: ["3DO Interactive Multiplayer", "Panasonic FZ-1", "Goldstar 3DO"],
    history: {
      en: [
        "The 3DO was a unique experiment: Trip Hawkins, founder of Electronic Arts, designed a console specification that could be licensed by different manufacturers. Panasonic, Goldstar (now LG), and Sanyo each produced their own 3DO versions. The idea was to apply the 'VHS model' to consoles — an open standard instead of proprietary hardware.",
        "Technically, the 3DO was impressive at its 1993 release. 32-bit graphics, CD-ROM, multimedia capabilities — on paper, it was superior to the competition. But the $699.99 price was prohibitive. Furthermore, the licensing model meant no manufacturer subsidized the loss, as Sony would later do with the PlayStation.",
        "The game library was mixed. There were some gems like Road Rash, Gex, and Return Fire, but also plenty of shovelware and FMV games. When the PlayStation arrived in 1994 for $299, the 3DO was no longer competitive. Trip Hawkins' vision of an open standard was ahead of its time — the concept works better today with Android-based consoles.",
      ],
      de: [
        "Die 3DO war ein einzigartiges Experiment: Trip Hawkins, Gründer von Electronic Arts, entwarf eine Konsolen-Spezifikation, die von verschiedenen Herstellern lizenziert werden konnte. Panasonic, Goldstar (heute LG) und Sanyo produzierten jeweils eigene 3DO-Versionen. Die Idee war, das 'VHS-Modell' auf Konsolen zu übertragen — ein offener Standard statt proprietärer Hardware.",
        "Technisch war die 3DO bei ihrer Veröffentlichung 1993 beeindruckend. 32-Bit-Grafik, CD-ROM, Multimedia-Fähigkeiten — auf dem Papier war sie der Konkurrenz überlegen. Doch der Preis von $699,99 war prohibitiv. Zudem führte das Lizenzmodell dazu, dass kein Hersteller den Verlust subventionierte, wie es Sony später mit der PlayStation tat.",
        "Die Spielebibliothek war durchwachsen. Es gab einige Perlen wie Road Rash, Gex und Return Fire, aber auch viel Shovelware und FMV-Spiele. Als die PlayStation 1994 für $299 erschien, war die 3DO nicht mehr konkurrenzfähig. Trip Hawkins' Vision eines offenen Standards war der Zeit voraus — das Konzept funktioniert heute mit Android-basierten Konsolen besser.",
      ],
    },
    facts: {
      unitsSold: "ca. 2 Millionen",
      cpu: "ARM60 (12,5 MHz)",
      gameLibrary: { en: "291 official games", de: "291 offizielle Spiele" },
      launchPrice: "$699,99 (Panasonic FZ-1, 1993)",
    },
    milestones: [
      { title: "Road Rash (3DO)", year: 1994, description: { en: "Definitive version of the motorcycle combat racer — best-selling 3DO title", de: "Definitive Version des Motorrad-Kampfrennspiels — meistverkaufter 3DO-Titel" } },
      { title: "Gex", year: 1994, description: { en: "Platformer with a wisecracking gecko mascot — became the 3DO's flagship title", de: "Plattformer mit sprechendem Gecko-Maskottchen — wurde zum 3DO-Aushängeschild" } },
      { title: "Return Fire", year: 1995, description: { en: "Multiplayer classic with classical music accompaniment and destructible environments", de: "Multiplayer-Klassiker mit klassischer Musikuntermalung und zerstörbarer Umgebung" } },
    ],
  },
  {
    platformId: "coleco",
    manufacturer: "Coleco",
    releaseYear: 1982,
    alternateNames: ["ColecoVision"],
    history: {
      en: [
        "The ColecoVision was the most technically advanced home console of 1982, offering near-arcade-quality graphics that made the Atari 2600 look outdated. Coleco's clever move was bundling it with the arcade hit Donkey Kong — the ColecoVision version was so close to the arcade original that it alone justified the purchase. In the first months after launch, the console sold faster than it could be manufactured.",
        "Coleco also offered the 'Expansion Module #1' — an adapter that could play Atari 2600 games on the ColecoVision. Atari sued Coleco over this, but the court ruled in Coleco's favor. This aggressive strategy secured the console an immediately large game library.",
        "The video game crash of 1983 hit Coleco hard as well. The company had also overextended itself with the Adam computer, which had technical problems and diverted focus from the core business. In 1985, Coleco discontinued the ColecoVision, and the company filed for bankruptcy in 1988. Nevertheless, the ColecoVision is remembered as a technical milestone.",
      ],
      de: [
        "Das ColecoVision war 1982 die technisch fortschrittlichste Heimkonsole und bot Arcade-nahe Grafik, die den Atari 2600 alt aussehen ließ. Colecos cleverer Schachzug war die Bündelung mit dem Arcade-Hit Donkey Kong — die ColecoVision-Version war der Arcade-Vorlage so nahe, dass sie allein den Kauf rechtfertigte. In den ersten Monaten nach dem Launch wurde die Konsole schneller verkauft als nachproduziert werden konnte.",
        "Coleco bot auch den 'Expansion Module #1' an — einen Adapter, der Atari-2600-Spiele auf dem ColecoVision abspielen konnte. Atari verklagte Coleco daraufhin, doch das Gericht entschied zugunsten von Coleco. Diese aggressive Strategie sicherte der Konsole eine sofortige große Spielebibliothek.",
        "Der Videospiel-Crash von 1983 traf auch Coleco hart. Das Unternehmen hatte sich zudem mit dem Adam-Computer übernommen, der technische Probleme hatte und den Fokus vom Kerngeschäft ablenkte. 1985 stellte Coleco die ColecoVision ein, und das Unternehmen meldete 1988 Insolvenz an. Trotzdem bleibt die ColecoVision als technischer Meilenstein in Erinnerung.",
      ],
    },
    facts: {
      unitsSold: "ca. 6 Millionen",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: { en: "136 official games", de: "136 offizielle Spiele" },
      launchPrice: "$199 (1982)",
    },
    milestones: [
      { title: "Donkey Kong", year: 1982, description: { en: "Bundle game and closest arcade port of its time — the system seller", de: "Bündelspiel und nächste Arcade-Portierung seiner Zeit — der Systemseller" } },
      { title: "Zaxxon", year: 1982, description: { en: "Isometric shoot-'em-up that demonstrated the hardware's graphical capabilities", de: "Isometrischer Shoot'em'up, der die grafischen Fähigkeiten der Hardware demonstrierte" } },
      { title: "Expansion Module #1", year: 1982, description: { en: "Adapter for Atari 2600 games — an aggressive and successful market strategy", de: "Adapter für Atari-2600-Spiele — eine aggressive und erfolgreiche Marktstrategie" } },
    ],
  },
  {
    platformId: "vectrex",
    manufacturer: "Smith Engineering / Milton Bradley / GCE",
    releaseYear: 1982,
    alternateNames: ["Vectrex"],
    history: {
      en: [
        "The Vectrex was one of the most unusual consoles in video game history — it had its own built-in vector display. While all other consoles had to be connected to a television, the Vectrex was a self-contained device with an integrated 9-inch monitor that displayed razor-sharp vector graphics, similar to the arcade classics Asteroids and Tempest.",
        "The vector graphics offered a unique visual style: bright lines on a black background, without the pixel artifacts of raster-based displays. To add color to the games, colored screen overlays were placed over the display — a charming trick reminiscent of the early days of television.",
        "The Vectrex launched at exactly the wrong time — right in the middle of the 1983 video game crash. Milton Bradley, which had taken over distribution, ceased production as early as 1984. Nevertheless, the Vectrex enjoys the highest cult status today. The homebrew scene is exceptionally active, and new games continue to be developed for the platform to this day.",
      ],
      de: [
        "Der Vectrex war eine der ungewöhnlichsten Konsolen der Videospielgeschichte — er hatte seinen eigenen eingebauten Vektorbildschirm. Während alle anderen Konsolen an einen Fernseher angeschlossen werden mussten, war der Vectrex ein eigenständiges Gerät mit integriertem 9-Zoll-Monitor, der gestochen scharfe Vektorgrafiken darstellte, ähnlich wie die Arcade-Klassiker Asteroids und Tempest.",
        "Die Vektorgrafik bot einen einzigartigen visuellen Stil: helle Linien auf schwarzem Hintergrund, ohne die Pixel-Artefakte rasterbasierter Displays. Um den Spielen Farbe zu verleihen, wurden Farbfolien (Screen Overlays) über den Bildschirm gelegt — ein charmanter Trick, der an die frühen Tage des Fernsehens erinnerte.",
        "Der Vectrex erschien genau zum falschen Zeitpunkt — mitten in den Videospiel-Crash von 1983. Milton Bradley, das den Vertrieb übernahm, stellte die Produktion bereits 1984 ein. Trotzdem genießt der Vectrex heute höchsten Kultstatus. Die Homebrew-Szene ist außergewöhnlich aktiv, und neue Spiele werden bis heute für die Plattform entwickelt.",
      ],
    },
    facts: {
      unitsSold: "ca. 1 Million (geschätzt)",
      cpu: "Motorola MC68A09 (1,5 MHz)",
      gameLibrary: { en: "29 official games + numerous homebrews", de: "29 offizielle Spiele + zahlreiche Homebrews" },
      launchPrice: "$199 (1982)",
    },
    milestones: [
      { title: "Mine Storm", year: 1982, description: { en: "Built-in game (Asteroids-like) — every Vectrex was ready to play immediately", de: "Eingebautes Spiel (Asteroids-ähnlich) — jeder Vectrex hatte es sofort spielbereit" } },
      { title: "Star Trek: The Motion Picture", year: 1982, description: { en: "Licensed game that used vector graphics perfectly for space combat", de: "Lizenzspiel, das die Vektorgrafik für Weltraumkämpfe perfekt nutzte" } },
      { title: "3D Imager", year: 1984, description: { en: "Accessory for stereoscopic 3D — visionary for 1984", de: "Zubehör für stereoskopisches 3D — visionär für 1984" } },
    ],
  },
  {
    platformId: "intellivision",
    manufacturer: "Mattel",
    releaseYear: 1979,
    alternateNames: ["Intellivision", "Mattel Intellivision"],
    history: {
      en: [
        "The Intellivision by Mattel was the first serious competitor to the Atari 2600 and sparked the first 'console war' in history. With a 16-bit processor (the first 16-bit console ever, albeit with 10-bit instructions), it offered better graphics than the Atari 2600. Mattel's aggressive advertising campaign featuring George Plimpton directly compared graphical quality — side-by-side comparisons that made the Atari look outdated.",
        "The Intellivision had a unique controller with a numeric keypad and a circular directional disc with 16 directions. Plastic overlays for the keypad were included with each game and showed game-specific button assignments. This controller was innovative but not particularly ergonomic.",
        "Mattel's Intellivision library included outstanding sports games that were far superior to the Atari versions. NBA Basketball, NFL Football, and MLB Baseball set standards. Titles like Utopia (an early strategy game) and Advanced Dungeons & Dragons also showed the platform's versatility. After the 1983 crash, Mattel finally ceased production in 1990.",
      ],
      de: [
        "Das Intellivision von Mattel war der erste ernsthafte Konkurrent des Atari 2600 und führte den ersten 'Konsolenkrieg' der Geschichte. Mit einem 16-Bit-Prozessor (der ersten 16-Bit-Konsole überhaupt, wenn auch mit 10-Bit-Befehlen) bot es bessere Grafik als der Atari 2600. Mattels aggressive Werbung mit George Plimpton verglich direkt die Grafikqualität — 'Side-by-Side'-Vergleiche, die den Atari alt aussehen ließen.",
        "Das Intellivision hatte einen einzigartigen Controller mit einer numerischen Tastatur und einer kreisförmigen Steuerungsscheibe mit 16 Richtungen. Plastikauflagen (Overlays) für die Tastatur wurden jedem Spiel beigelegt und zeigten die spielspezifischen Tastenbelegungen. Dieser Controller war innovativ, aber nicht besonders ergonomisch.",
        "Mattels Intellivision-Bibliothek umfasste herausragende Sportspiele, die den Atari-Versionen weit überlegen waren. NBA Basketball, NFL Football und MLB Baseball setzten Maßstäbe. Auch Titel wie Utopia (ein frühes Strategiespiel) und Advanced Dungeons & Dragons zeigten die Vielseitigkeit der Plattform. Nach dem Crash von 1983 stellte Mattel die Produktion 1990 endgültig ein.",
      ],
    },
    facts: {
      unitsSold: "ca. 3 Millionen",
      cpu: "General Instrument CP1610 (894 kHz)",
      gameLibrary: { en: "125 official games", de: "125 offizielle Spiele" },
      launchPrice: "$299 (1979)",
    },
    milestones: [
      { title: "Astrosmash", year: 1981, description: { en: "Best-selling Intellivision game — fast arcade gameplay with high-score chasing", de: "Meistverkauftes Intellivision-Spiel — schnelles Arcade-Gameplay mit High-Score-Jagd" } },
      { title: "Advanced Dungeons & Dragons", year: 1982, description: { en: "First official D&D video game — an action-adventure milestone", de: "Erstes offizielles D&D-Videospiel — ein Action-Adventure-Meilenstein" } },
      { title: "Utopia", year: 1981, description: { en: "Considered the first city-building strategy game in video game history", de: "Gilt als erstes Aufbaustrategiespiel der Videospielgeschichte" } },
    ],
  },
  {
    platformId: "odyssey2",
    manufacturer: "Magnavox / Philips",
    releaseYear: 1978,
    alternateNames: ["Odyssey 2 (Nordamerika)", "Videopac G7000 (Europa)", "Philips Videopac"],
    history: {
      en: [
        "The Odyssey 2, known in Europe as the Philips Videopac G7000, was Magnavox's successor to the very first home console — the Magnavox Odyssey from 1972. Unlike the Atari 2600, the Odyssey 2 had a full membrane keyboard, positioning it as a hybrid between game console and educational computer.",
        "The keyboard enabled some unique game concepts. The game 'Quest for the Rings' combined a board game with the console and used the keyboard for inputs. 'Type & Tell' was an educational program with speech synthesis — impressive for 1982. In Europe, the Odyssey 2/Videopac was more successful than in North America and sold particularly well in the Netherlands and Brazil.",
        "Despite some innovative titles, the Odyssey 2 remained technically behind the Atari 2600 and could not keep up with the competitor's growing game library. The most famous game, K.C. Munchkin (a Pac-Man clone), was pulled from shelves after a lawsuit by Atari — ironically, it was considered the better game.",
      ],
      de: [
        "Die Odyssey 2, in Europa als Philips Videopac G7000 bekannt, war Magnavox' Nachfolger der allerersten Heimkonsole — der Magnavox Odyssey von 1972. Im Gegensatz zum Atari 2600 hatte die Odyssey 2 eine vollwertige Membrantastatur, was sie als Hybrid zwischen Spielkonsole und Lerncomputer positionierte.",
        "Die Tastatur ermöglichte einige einzigartige Spielkonzepte. Das Spiel 'Quest for the Rings' kombinierte ein Brettspiel mit der Konsole und nutzte die Tastatur für Eingaben. 'Type & Tell' war ein Lernprogramm mit Sprachsynthese — beeindruckend für 1982. In Europa war die Odyssey 2/Videopac erfolgreicher als in Nordamerika und verkaufte sich besonders gut in den Niederlanden und Brasilien.",
        "Trotz einiger innovativer Titel blieb die Odyssey 2 technisch hinter dem Atari 2600 zurück und konnte nicht mit der wachsenden Spielebibliothek des Konkurrenten mithalten. Das bekannteste Spiel, K.C. Munchkin (ein Pac-Man-Klon), wurde nach einer Klage von Atari vom Markt genommen — ironischerweise galt es als das bessere Spiel.",
      ],
    },
    facts: {
      unitsSold: "ca. 2 Millionen",
      cpu: "Intel 8048 (1,79 MHz)",
      gameLibrary: { en: "77 official games", de: "77 offizielle Spiele" },
      launchPrice: "$179 (1978)",
    },
    milestones: [
      { title: "K.C. Munchkin!", year: 1981, description: { en: "Pac-Man-inspired game that was pulled from shelves after Atari's lawsuit", de: "Pac-Man-inspiriertes Spiel, das nach Ataris Klage vom Markt genommen wurde" } },
      { title: "Quest for the Rings", year: 1981, description: { en: "Innovative hybrid of board game and video game with keyboard usage", de: "Innovatives Hybrid aus Brettspiel und Videospiel mit Keyboard-Nutzung" } },
      { title: "Pick Axe Pete!", year: 1982, description: { en: "Popular platformer considered one of the best Odyssey 2 games", de: "Beliebter Plattformer, der zu den besten Odyssey-2-Spielen zählt" } },
    ],
  },
  {
    platformId: "channelf",
    manufacturer: "Fairchild Semiconductor",
    releaseYear: 1976,
    alternateNames: ["Fairchild Channel F", "Video Entertainment System (VES)"],
    history: {
      en: [
        "The Fairchild Channel F was the very first home console with interchangeable ROM cartridges — a full year before the Atari VCS (2600). Developed by Jerry Lawson, one of the few African-American engineers in the early video game industry, it was a technological milestone. Before the Channel F, consoles were limited to hardwired built-in games.",
        "The Channel F offered advanced features for its time: a dedicated processor (the Fairchild F8), color graphics, and even a built-in speaker. The controllers had a unique joystick that could be moved in eight directions, twisted, and pushed. Games were distributed on 'Videocarts' — yellow plastic cartridges.",
        "But when the Atari 2600 arrived in 1977, the Channel F could not compete. Atari's superior marketing and stronger game library quickly displaced it. Fairchild sold the console division to Zircon International, who released a revised 'Channel F System II' before production was finally discontinued. Nevertheless, the Channel F deserves respect as the pioneer of the modern console game.",
      ],
      de: [
        "Die Fairchild Channel F war die allererste Heimkonsole mit austauschbaren ROM-Cartridges — ein Jahr vor dem Atari VCS (2600). Entwickelt von Jerry Lawson, einem der wenigen afroamerikanischen Ingenieure in der frühen Videospielindustrie, war sie ein technologischer Meilenstein. Vor der Channel F waren Konsolen auf fest einprogrammierte Spiele beschränkt.",
        "Die Channel F bot für ihre Zeit fortschrittliche Features: einen eigenen Prozessor (den Fairchild F8), Farbgrafik und sogar einen eingebauten Lautsprecher. Die Controller hatten einen einzigartigen Joystick, der in acht Richtungen bewegt, gedreht und gedrückt werden konnte. Die Spiele wurden auf 'Videocarts' verteilt — gelbe Plastikmodule.",
        "Doch als der Atari 2600 1977 erschien, konnte die Channel F nicht mithalten. Ataris überlegenes Marketing und die stärkere Spielebibliothek verdrängten sie schnell. Fairchild verkaufte die Konsolensparte an Zircon International, die eine überarbeitete 'Channel F System II' herausbrachten, bevor die Produktion endgültig eingestellt wurde. Trotzdem gebührt der Channel F der Respekt als Pionierin des modernen Konsolenspiels.",
      ],
    },
    facts: {
      unitsSold: "ca. 250.000",
      cpu: "Fairchild F8 (1,79 MHz)",
      gameLibrary: { en: "27 official Videocarts", de: "27 offizielle Videocarts" },
      launchPrice: "$169,95 (1976)",
    },
    milestones: [
      { title: "Videocart-1: Tic-Tac-Toe", year: 1976, description: { en: "One of the first interchangeable game cartridges in video game history", de: "Einer der ersten austauschbaren Spielmodule der Videospielgeschichte" } },
      { title: "Videocart-2: Desert Fox/Shooting Gallery", year: 1976, description: { en: "Tank and shooting game that demonstrated the system's capabilities", de: "Panzer- und Schieß-Spiel, das die Möglichkeiten des Systems demonstrierte" } },
      { title: "Jerry Lawsons Vermächtnis", year: 1976, description: { en: "African-American engineer Jerry Lawson invented the cartridge system and shaped the industry", de: "Der afroamerikanische Ingenieur Jerry Lawson erfand das Cartridge-System und prägte die Industrie" } },
    ],
  },
  // ── Computers ──
  {
    platformId: "dos",
    manufacturer: "IBM / Microsoft",
    releaseYear: 1981,
    alternateNames: ["MS-DOS", "PC-DOS", "IBM PC"],
    history: {
      en: [
        "MS-DOS was not a gaming system in the traditional sense — it was the operating system on which the PC gaming revolution took place. From early text adventures through the Sierra and LucasArts era to the first first-person shooters, DOS shaped computer gaming for over 15 years. The open PC architecture allowed constant hardware upgrades, leading to an arms race that consoles simply could not match.",
        "The early 1980s belonged to Infocom's text adventures (Zork) and the beginnings of the Sierra On-Line era. In the late '80s, LucasArts (Monkey Island, Indiana Jones) and Sierra (King's Quest, Space Quest) revolutionized the adventure genre. The '90s then brought the first-person shooter boom: Wolfenstein 3D (1992), Doom (1993), and Quake (1996) changed the gaming landscape forever.",
        "DOS gaming was also home to strategy games (Civilization, X-COM, Command & Conquer), RPGs (Ultima, Baldur's Gate), and simulations (SimCity, Flight Simulator). The era ended in the mid-'90s with the rise of Windows 95, but thanks to DOSBox, the DOS gaming legacy lives on — thousands of classics are more accessible today than ever before."
      ],
      de: [
        "MS-DOS war kein Spielsystem im klassischen Sinne — es war das Betriebssystem, auf dem die PC-Gaming-Revolution stattfand. Von den frühen Textadventures über die Sierra-und-LucasArts-Ära bis hin zu den ersten Ego-Shootern prägte DOS über 15 Jahre lang das Computer-Gaming. Die offene PC-Architektur ermöglichte ständige Hardware-Upgrades, was zu einem Wettrüsten führte, die Konsolen nicht bieten konnten.",
        "Die frühen 80er Jahre gehörten Textadventures von Infocom (Zork) und den Anfängen der Sierra-On-Line-Ära. In den späten 80ern revolutionierten LucasArts (Monkey Island, Indiana Jones) und Sierra (King's Quest, Space Quest) das Adventure-Genre. Die 90er brachten dann den Ego-Shooter-Boom: Wolfenstein 3D (1992), Doom (1993) und Quake (1996) veränderten die Spielelandschaft für immer.",
        "DOS-Gaming war auch die Heimat der Strategiespiele (Civilization, X-COM, Command & Conquer), der RPGs (Ultima, Baldur's Gate) und der Simulationen (SimCity, Flight Simulator). Die Ära endete Mitte der 90er mit dem Aufstieg von Windows 95, doch dank DOSBox lebt das DOS-Gaming-Erbe weiter — tausende Klassiker sind heute einfacher zugänglich als je zuvor."
      ],
    },
    facts: {
      unitsSold: "Hunderte Millionen PCs (plattformübergreifend)",
      cpu: "Intel 8088 bis Pentium (4,77 MHz bis 200+ MHz)",
      gameLibrary: { en: "Thousands of games", de: "Tausende Spiele" },
      launchPrice: "$1.565 (IBM PC, 1981)",
    },
    milestones: [
      { title: "Doom", year: 1993, description: { en: "Defined the first-person shooter and popularized LAN multiplayer — a cultural phenomenon", de: "Definierte den Ego-Shooter und popularisierte LAN-Multiplayer — ein kulturelles Phänomen" } },
      { title: "The Secret of Monkey Island", year: 1990, description: { en: "LucasArts' masterpiece with the SCUMM engine — humor and puzzles perfectly combined", de: "LucasArts' Meisterwerk mit SCUMM-Engine — Humor und Rätsel perfekt vereint" } },
      { title: "Sid Meier's Civilization", year: 1991, description: { en: "Founded the 'one more turn' strategy genre — one of the most influential series to this day", de: "Begründete das Strategiespiel-Genre 'Noch eine Runde' — bis heute eine der einflussreichsten Serien" } },
      { title: "Wolfenstein 3D", year: 1992, description: { en: "The 'grandfather' of first-person shooters — paved the way for Doom", de: "Der 'Großvater' der Ego-Shooter — ebnete den Weg für Doom" } },
      { title: "X-COM: UFO Defense", year: 1994, description: { en: "Perfect blend of tactics and strategy — successfully rebooted in 2012", de: "Perfekte Mischung aus Taktik und Strategie — wurde 2012 erfolgreich wiederbelebt" } },
    ],
  },
  {
    platformId: "c64",
    manufacturer: "Commodore",
    releaseYear: 1982,
    alternateNames: ["Commodore 64", "C64", "CBM 64", "Brotkasten"],
    history: {
      en: [
        "The Commodore 64 is the best-selling single computer model of all time — between 12.5 and 17 million units, depending on the source. Affectionately nicknamed 'Brotkasten' (breadbox) in Germany, it shaped an entire generation of gamers and programmers. For many Europeans, the C64 was their first introduction to the world of computers and video games.",
        "The SID sound chip (MOS 6581/8580) was an acoustic marvel. With three voices and programmable filters, it enabled music that sounded incredible for an 8-bit computer. Composers like Rob Hubbard, Martin Galway, and Ben Daglish created soundtracks that are celebrated to this day. The SID music scene lives on as the 'chiptune' movement.",
        "The C64's game library was enormous — over 10,000 commercial titles were released. In Europe, the C64 dominated the home computer market throughout the 1980s. Classics like Impossible Mission, Maniac Mansion, Pitstop II, The Last Ninja, and Boulder Dash defined gaming culture. The cracking and demo scene also originated on the C64 — groups like Fairlight and 1001 Crew got their start here."
      ],
      de: [
        "Der Commodore 64 ist der meistverkaufte Einzelcomputer aller Zeiten — zwischen 12,5 und 17 Millionen Einheiten, je nach Quelle. In Deutschland liebevoll 'Brotkasten' genannt, prägte er eine ganze Generation von Spielern und Programmierern. Für viele Europäer war der C64 der Einstieg in die Welt der Computer und Videospiele.",
        "Der SID-Soundchip (MOS 6581/8580) war ein akustisches Wunderwerk. Mit drei Stimmen und programmierbaren Filtern ermöglichte er Musik, die für einen 8-Bit-Computer unglaublich klang. Komponisten wie Rob Hubbard, Martin Galway und Ben Daglish schufen Soundtracks, die bis heute gefeiert werden. Die SID-Musik-Szene lebt bis heute als 'Chiptune'-Bewegung weiter.",
        "Die Spielebibliothek des C64 war gigantisch — über 10.000 kommerzielle Titel erschienen. In Europa dominierte der C64 den Heimcomputer-Markt der 80er Jahre. Klassiker wie Impossible Mission, Maniac Mansion, Pitstop II, The Last Ninja und Boulder Dash prägten die Spielekultur. Auch die Cracking- und Demo-Szene hatte auf dem C64 ihren Ursprung — Gruppen wie Fairlight und 1001 Crew begannen hier."
      ],
    },
    facts: {
      unitsSold: "12,5-17 Millionen",
      cpu: "MOS 6510 (1,023 MHz PAL / 1,023 MHz NTSC)",
      gameLibrary: { en: "10,000+ games", de: "10.000+ Spiele" },
      launchPrice: "$595 (1982)",
    },
    milestones: [
      { title: "Impossible Mission", year: 1984, description: { en: "Digitized speech ('Stay a while... stay forever!') and puzzle-platformer perfection", de: "Digitalisierte Sprachausgabe ('Stay a while... stay forever!') und Puzzle-Plattformer-Perfektion" } },
      { title: "The Last Ninja", year: 1987, description: { en: "Isometric action-adventure with impressive graphics and atmosphere", de: "Isometrisches Action-Adventure mit beeindruckender Grafik und Atmosphäre" } },
      { title: "Maniac Mansion", year: 1987, description: { en: "LucasArts' first SCUMM adventure — ushered in a new era of point-and-click games", de: "LucasArts' erstes SCUMM-Adventure — begründete eine neue Ära der Point-and-Click-Spiele" } },
      { title: "Boulder Dash", year: 1984, description: { en: "Addictive puzzle-action game that continues to inspire imitators to this day", de: "Suchterzeugendes Puzzle-Action-Spiel, das bis heute Nachahmer inspiriert" } },
      { title: "International Karate +", year: 1987, description: { en: "One of the best fighting games of the 8-bit era by Archer MacLean", de: "Eines der besten Kampfspiele der 8-Bit-Ära von Archer MacLean" } },
    ],
  },
  {
    platformId: "amiga",
    manufacturer: "Commodore",
    releaseYear: 1985,
    alternateNames: ["Commodore Amiga", "Amiga 500", "Amiga 1200", "A500", "A1200"],
    history: {
      en: [
        "The Amiga was years ahead of its time. When it launched in 1985, it offered preemptive multitasking, a graphical user interface, and custom chips for graphics and sound that outclassed everything else on the market. The Amiga 500 (1987) became the best-selling model and the epitome of European home computing in the late '80s and early '90s.",
        "The Amiga was particularly revolutionary in multimedia. Video Toaster turned it into a semi-professional video editing station — the special effects for the TV series Babylon 5 and early MTV broadcasts were produced on Amigas. In the demo scene, the Amiga was the reference platform, and groups like The Black Lotus and Sanity created breathtaking audiovisual artworks.",
        "As a gaming platform, the Amiga was unmatched. The Bitmap Brothers (Speedball 2, The Chaos Engine), Team17 (Worms, Alien Breed), Sensible Software (Sensible World of Soccer), and countless other studios delivered masterpieces. The Amiga profoundly shaped European game development — many of the greatest British and Scandinavian studios have their roots on the Amiga."
      ],
      de: [
        "Der Amiga war seiner Zeit um Jahre voraus. Als er 1985 erschien, bot er präemptives Multitasking, eine grafische Benutzeroberfläche und Custom-Chips für Grafik und Sound, die alles in den Schatten stellten. Der Amiga 500 (1987) wurde zum meistverkauften Modell und zum Inbegriff des europäischen Home-Computings der späten 80er und frühen 90er Jahre.",
        "Besonders im Bereich Multimedia war der Amiga revolutionär. Video Toaster verwandelte ihn in eine semi-professionelle Videobearbeitungsstation — die Spezialeffekte der TV-Serie Babylon 5 und frühe Sendungen von MTV wurden auf Amigas produziert. In der Demoszene war der Amiga die Referenzplattform, und Gruppen wie The Black Lotus und Sanity schufen atemberaubende audiovisuelle Kunstwerke.",
        "Als Spieleplattform war der Amiga unübertroffen. Die Bitmap Brothers (Speedball 2, The Chaos Engine), Team17 (Worms, Alien Breed), Sensible Software (Sensible World of Soccer) und unzählige andere Studios lieferten Meisterwerke. Der Amiga prägte die europäische Spieleentwicklung maßgeblich — viele der größten britischen und skandinavischen Studios haben ihre Wurzeln auf dem Amiga."
      ],
    },
    facts: {
      unitsSold: "ca. 6 Millionen (alle Modelle)",
      cpu: "Motorola 68000 (7,14 MHz, A500)",
      gameLibrary: { en: "5,000+ games", de: "5.000+ Spiele" },
      launchPrice: "$1.295 (Amiga 1000, 1985) / $699 (Amiga 500, 1987)",
    },
    milestones: [
      { title: "Lemmings", year: 1991, description: { en: "By DMA Design (later Rockstar North) — one of the most influential puzzle games of all time", de: "Von DMA Design (später Rockstar North) — eines der einflussreichsten Puzzlespiele aller Zeiten" } },
      { title: "Speedball 2: Brutal Deluxe", year: 1990, description: { en: "Bitmap Brothers' futuristic sports action game — perfection in level design and gameplay", de: "Bitmap Brothers' futuristisches Sport-Action-Spiel — Perfektion in Leveldesign und Gameplay" } },
      { title: "Sensible World of Soccer", year: 1994, description: { en: "Legendary football game with over 27,000 real players — still unmatched in addictiveness", de: "Legendäres Fußballspiel mit über 27.000 realen Spielern — bis heute unerreicht im Suchtfaktor" } },
      { title: "Turrican II", year: 1991, description: { en: "Factor 5's action masterpiece with one of the best soundtracks of the 16-bit era (Chris Hülsbeck)", de: "Factors 5 Action-Meisterwerk mit einem der besten Soundtracks der 16-Bit-Ära (Chris Hülsbeck)" } },
      { title: "Shadow of the Beast", year: 1989, description: { en: "Technical showcase of the Amiga hardware with parallax scrolling across 13 layers", de: "Technische Demo der Amiga-Hardware mit Parallax-Scrolling auf 13 Ebenen" } },
    ],
  },
  {
    platformId: "msx",
    manufacturer: "Microsoft / ASCII Corporation (Standard)",
    releaseYear: 1983,
    alternateNames: ["MSX", "MSX2", "MSX2+", "MSX turboR"],
    history: {
      en: [
        "MSX was not a single computer but an open hardware standard, initiated by Kazuhiko Nishi (ASCII Corporation) in collaboration with Microsoft. The idea: different manufacturers (Sony, Panasonic, Philips, Yamaha, and many more) would produce compatible computers so that software would run universally. In Japan, Korea, and parts of Europe (especially the Netherlands and Spain), MSX was a major success.",
        "The MSX became the birthplace of some of the most iconic game series. Hideo Kojima's Metal Gear debuted in 1987 on the MSX2 — the NES version was an inferior port. Konami supported the platform excellently with titles like Vampire Killer (Castlevania), Penguin Adventure (an early Kojima work), and Nemesis (Gradius). The Bomberman series also had its origins on the MSX.",
        "The standard evolved across four generations: MSX (1983), MSX2 (1985) with improved graphics, MSX2+ (1988) with hardware scrolling, and MSX turboR (1990) with a 16-bit processor. In Japan, the platform held on until the early '90s. The MSX community remains active to this day, and the standard is recognized as an important contribution to Japanese gaming history."
      ],
      de: [
        "MSX war kein einzelner Computer, sondern ein offener Hardware-Standard, initiiert von Kazuhiko Nishi (ASCII Corporation) in Zusammenarbeit mit Microsoft. Die Idee: Verschiedene Hersteller (Sony, Panasonic, Philips, Yamaha und viele mehr) produzieren kompatible Computer, sodass Software universell läuft. In Japan, Korea und Teilen Europas (besonders den Niederlanden und Spanien) war MSX ein großer Erfolg.",
        "Der MSX wurde zur Geburtsstätte einiger der bekanntesten Spieleserien. Hideo Kojimas Metal Gear erschien 1987 zuerst auf dem MSX2 — die NES-Version war ein minderwertiger Port. Konami unterstützte die Plattform hervorragend mit Titeln wie Vampire Killer (Castlevania), Penguin Adventure (frühes Werk von Kojima) und Nemesis (Gradius). Auch die Bomberman-Serie hatte ihren Ursprung auf dem MSX.",
        "Der Standard entwickelte sich über vier Generationen: MSX (1983), MSX2 (1985) mit verbesserter Grafik, MSX2+ (1988) mit Hardware-Scrolling und MSX turboR (1990) mit 16-Bit-Prozessor. In Japan hielt sich die Plattform bis Anfang der 90er. Die MSX-Community ist bis heute aktiv, und der Standard wird als wichtiger Beitrag zur japanischen Spielegeschichte gewürdigt."
      ],
    },
    facts: {
      unitsSold: "ca. 5 Millionen (alle Varianten weltweit)",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: { en: "2,000+ games", de: "2.000+ Spiele" },
      launchPrice: "Variierte je nach Hersteller (ca. 50.000-100.000 Yen)",
    },
    milestones: [
      { title: "Metal Gear", year: 1987, description: { en: "Hideo Kojima's first Metal Gear debuted on the MSX2 — the definitive version", de: "Hideo Kojimas erstes Metal Gear erschien auf dem MSX2 — die definitive Version" } },
      { title: "Vampire Killer", year: 1986, description: { en: "The MSX2 version of Castlevania with unique, exploration-heavy gameplay", de: "Die MSX2-Version von Castlevania mit eigenständigem, explorationslastigem Gameplay" } },
      { title: "Penguin Adventure", year: 1986, description: { en: "Early work by Hideo Kojima with surprising depth for a penguin game", de: "Frühes Werk von Hideo Kojima mit überraschendem Tiefgang für ein Pinguinspiel" } },
      { title: "Space Manbow", year: 1989, description: { en: "Konami's technically impressive shoot'em up for the MSX2", de: "Konamis technisch beeindruckender Shoot'em'up für den MSX2" } },
    ],
  },
  {
    platformId: "zxspectrum",
    manufacturer: "Sinclair Research",
    releaseYear: 1982,
    alternateNames: ["ZX Spectrum", "Speccy", "Sinclair Spectrum"],
    history: {
      en: [
        "Sir Clive Sinclair's ZX Spectrum was the computer that founded the British games industry. At a price of just 125 pounds (for the 16K version), it was affordable enough to find its way into British bedrooms and living rooms. The distinctive rubber keyboard and rainbow stripe on the case became icons of the 1980s.",
        "The gaming industry that formed around the Spectrum was unique. Teenage programmers like Matthew Smith (Manic Miner, Jet Set Willy), the Oliver Twins (Dizzy), and Ultimate Play the Game (later Rare!) founded studios in their bedrooms that shaped the British gaming landscape. The Spectrum was the cradle of Rare, Codemasters, Psygnosis, and many other legendary studios.",
        "Software was distributed on standard audio cassettes — loading a game took several minutes and was accompanied by characteristic beeping and colorful screen stripes. Despite the modest hardware (only 8 colors per 8x8 pixel block, which led to the infamous 'colour clash'), thousands of games were released. In former Eastern Bloc countries, especially Russia, the Spectrum remained popular through clones like the 'Pentagon' well into the 1990s."
      ],
      de: [
        "Der ZX Spectrum von Sir Clive Sinclair war der Computer, der die britische Spieleindustrie begründete. Mit einem Preis von nur 125 Pfund (für die 16K-Version) war er erschwinglich genug, um in britische Kinderzimmer und Wohnungen einzuziehen. Die markante Gummitastatur und der Regenbogenstreifen am Gehäuse wurden zu Ikonen der 80er Jahre.",
        "Die Spieleindustrie, die sich um den Spectrum bildete, war einzigartig. Jugendliche Programmierer wie Matthew Smith (Manic Miner, Jet Set Willy), die Oliver Twins (Dizzy) und Ultimate Play the Game (später Rare!) gründeten in ihren Kinderzimmern Studios, die die britische Gaming-Landschaft prägten. Der Spectrum war die Wiege von Rare, Codemasters, Psygnosis und vielen anderen legendären Studios.",
        "Software wurde auf handelsüblichen Audiokassetten verteilt — das Laden eines Spiels dauerte mehrere Minuten und wurde von charakteristischem Piepen und bunten Bildschirmstreifen begleitet. Trotz der bescheidenen Hardware (nur 8 Farben pro 8x8-Pixel-Block, was zum berühmten 'Colour Clash' führte) erschienen tausende Spiele. In den ehemaligen Ostblockstaaten, besonders Russland, war der Spectrum durch Klone wie den 'Pentagon' noch bis in die 90er Jahre populär."
      ],
    },
    facts: {
      unitsSold: "ca. 5 Millionen (offizielle Modelle)",
      cpu: "Zilog Z80A (3,5 MHz)",
      gameLibrary: { en: "10,000+ games", de: "10.000+ Spiele" },
      launchPrice: "125 Pfund (16K) / 175 Pfund (48K, 1982)",
    },
    milestones: [
      { title: "Manic Miner", year: 1983, description: { en: "Programmed by Matthew Smith at age 16 — founded the British platformer", de: "Von Matthew Smith mit 16 Jahren programmiert — begründete den britischen Plattformer" } },
      { title: "Jet Set Willy", year: 1984, description: { en: "Open-world platformer that became a cultural phenomenon in Britain", de: "Open-World-Plattformer, der in Großbritannien zum kulturellen Phänomen wurde" } },
      { title: "Elite", year: 1985, description: { en: "Revolutionary 3D space simulator by David Braben and Ian Bell — 8 galaxies in 48K", de: "Revolutionärer 3D-Weltraumsimulator von David Braben und Ian Bell — 8 Galaxien auf 48K" } },
      { title: "Knight Lore", year: 1984, description: { en: "Ultimate's isometric masterpiece — introduced the 'Filmation' engine and shaped the isometric genre", de: "Ultimates isometrisches Meisterwerk — prägte die 'Filmation'-Engine und das isometrische Genre" } },
    ],
  },
  {
    platformId: "amstrad",
    manufacturer: "Amstrad",
    releaseYear: 1984,
    alternateNames: ["Amstrad CPC", "CPC 464", "CPC 6128", "GX4000"],
    history: {
      en: [
        "The Amstrad CPC (Colour Personal Computer) was Alan Sugar's answer to the home computer boom of the early 1980s. The clever move: the CPC 464 was sold as a complete package with an integrated cassette drive and monitor — no fiddling with the family television required. In Britain, France, and Spain, the CPC was a major success.",
        "Technically, the CPC sat between the ZX Spectrum and the Commodore 64. It had a similar processor to the Spectrum but offered better color reproduction (27 colors) and a built-in sound chip (AY-3-8912). In France, the CPC was at times the most popular home computer and had a vibrant native game development scene.",
        "In 1990, Amstrad attempted to enter the console market with the GX4000 — a pure gaming console based on CPC Plus hardware. The attempt failed miserably, as the market was already dominated by the Mega Drive and Super Nintendo. The GX4000 was discontinued after just six months. Nevertheless, the CPC remains an important part of European computing history."
      ],
      de: [
        "Der Amstrad CPC (Colour Personal Computer) war Alan Sugars Antwort auf den Heimcomputerboom der frühen 80er Jahre. Der clevere Schachzug: Der CPC 464 wurde als Komplettpaket mit integriertem Kassettenlaufwerk und Monitor verkauft — keine Basteleien mit dem Familienfernseher nötig. In Großbritannien, Frankreich und Spanien war der CPC ein großer Erfolg.",
        "Technisch lag der CPC zwischen dem ZX Spectrum und dem Commodore 64. Er hatte einen ähnlichen Prozessor wie der Spectrum, bot aber eine bessere Farbdarstellung (27 Farben) und einen eingebauten Soundchip (AY-3-8912). In Frankreich war der CPC zeitweise der beliebteste Heimcomputer und hatte eine lebhafte eigene Spieleentwicklerszene.",
        "1990 versuchte Amstrad mit dem GX4000 den Sprung in den Konsolenmarkt — eine reine Spielkonsole basierend auf der CPC-Plus-Hardware. Der Versuch scheiterte kläglich, da der Markt bereits vom Mega Drive und Super Nintendo dominiert wurde. Der GX4000 wurde nach nur sechs Monaten eingestellt. Trotzdem bleibt der CPC ein wichtiger Teil der europäischen Computergeschichte."
      ],
    },
    facts: {
      unitsSold: "ca. 3 Millionen",
      cpu: "Zilog Z80A (4 MHz)",
      gameLibrary: { en: "3,000+ games", de: "3.000+ Spiele" },
      launchPrice: "199 Pfund (CPC 464 mit Grünmonitor, 1984)",
    },
    milestones: [
      { title: "Gryzor (Contra)", year: 1987, description: { en: "Outstanding port of the arcade classic — one of the best CPC games", de: "Herausragende Portierung des Arcade-Klassikers — eines der besten CPC-Spiele" } },
      { title: "Renegade", year: 1987, description: { en: "Beat'em up classic that was superbly adapted on the CPC", de: "Beat'em'up-Klassiker, der auf dem CPC hervorragend umgesetzt wurde" } },
      { title: "GX4000-Launch", year: 1990, description: { en: "Amstrad's failed attempt to enter the console market with a CPC-based console", de: "Amstrads gescheiterter Versuch, mit einer CPC-basierten Konsole in den Konsolenmarkt einzusteigen" } },
    ],
  },
  {
    platformId: "bbcmicro",
    manufacturer: "Acorn Computers",
    releaseYear: 1981,
    alternateNames: ["BBC Micro", "BBC Microcomputer", "Beeb"],
    history: {
      en: [
        "The BBC Micro was born from an ambitious educational program by the British Broadcasting Corporation (BBC). The goal: promote computer literacy across all of Britain. Acorn Computers won the tender against Sinclair and delivered a robust, expandable computer that became the standard in British schools. An entire generation of British programmers learned on the 'Beeb'.",
        "Technically, the BBC Micro was ahead of its time. Its advanced BBC BASIC implementation with an integrated assembler, fast graphics modes, and numerous expansion ports made it the ideal learning platform. David Braben and Ian Bell originally developed 'Elite' on the BBC Micro — the revolutionary 3D space game that influenced the entire industry.",
        "Acorn Computers, the maker of the BBC Micro, later developed the ARM processor architecture for its successor, the Archimedes. ARM — now found in virtually every smartphone in the world — has its origins directly in the BBC Micro era. Thus, an educational project from the 1980s indirectly led to the most dominant chip architecture of the 21st century."
      ],
      de: [
        "Der BBC Micro entstand aus einem ambitionierten Bildungsprogramm der British Broadcasting Corporation (BBC). Das Ziel: Computer-Kompetenz in ganz Großbritannien fördern. Acorn Computers gewann die Ausschreibung gegen Sinclair und lieferte einen robusten, erweiterbaren Computer, der zum Standard in britischen Schulen wurde. Eine ganze Generation britischer Programmierer lernte auf dem 'Beeb'.",
        "Technisch war der BBC Micro seiner Zeit voraus. Die fortschrittliche BBC BASIC-Implementierung mit integriertem Assembler, schnelle Grafikmodi und zahlreiche Erweiterungsports machten ihn zur idealen Lernplattform. David Braben und Ian Bell entwickelten 'Elite' ursprünglich auf dem BBC Micro — das revolutionäre 3D-Weltraumspiel, das die gesamte Branche beeinflusste.",
        "Acorn Computers, der Hersteller des BBC Micro, entwickelte später die ARM-Prozessorarchitektur für den Nachfolger Archimedes. ARM — heute in praktisch jedem Smartphone der Welt verbaut — hat seinen Ursprung direkt in der BBC-Micro-Ära. So führte ein Bildungsprojekt der 80er Jahre indirekt zur dominantesten Chiparchitektur des 21. Jahrhunderts."
      ],
    },
    facts: {
      unitsSold: "ca. 1,5 Millionen",
      cpu: "MOS 6502A (2 MHz)",
      gameLibrary: { en: "2,000+ games and programs", de: "2.000+ Spiele und Programme" },
      launchPrice: "235 Pfund (Model A) / 335 Pfund (Model B, 1981)",
    },
    milestones: [
      { title: "Elite", year: 1984, description: { en: "Revolutionary 3D space game — originally developed on the BBC Micro", de: "Revolutionäres 3D-Weltraumspiel — ursprünglich auf dem BBC Micro entwickelt" } },
      { title: "Repton", year: 1985, description: { en: "Popular puzzle game that became a BBC Micro classic", de: "Beliebtes Puzzle-Spiel, das zum BBC-Micro-Klassiker wurde" } },
      { title: "ARM-Prozessor-Entwicklung", year: 1985, description: { en: "Acorn developed ARM for its successor — now found in billions of devices", de: "Acorn entwickelte ARM für den Nachfolger — heute in Milliarden von Geräten verbaut" } },
    ],
  },
  {
    platformId: "x68000",
    manufacturer: "Sharp",
    releaseYear: 1987,
    alternateNames: ["Sharp X68000", "X68K"],
    history: {
      en: [
        "The Sharp X68000 was the ultimate arcade-at-home machine — a Japanese home computer that, thanks to its Motorola 68000 CPU and powerful custom chips, enabled arcade-perfect ports. Capcom even used the X68000 as a development platform for its CPS-1 arcade games, resulting in near-flawless home conversions.",
        "The striking design of the X68000 — a futuristic dual-tower enclosure — was as distinctive as its technical capabilities. The hardware offered 65,536 colors, hardware sprites, scrolling layers, and FM sound — everything needed for arcade-perfect conversions. Street Fighter II, Gradius, Castlevania Chronicles, and Final Fight were among the standout titles.",
        "The X68000 was available exclusively in Japan and remained a niche product for enthusiasts. The high price (nearly 370,000 yen at launch) limited its audience. Nevertheless, the X68000 enjoys legendary status among retro computing fans today as the platform with the best arcade ports of the 16-bit era."
      ],
      de: [
        "Der Sharp X68000 war die ultimative Arcade-zu-Hause-Maschine — ein japanischer Heimcomputer, der dank seiner Motorola-68000-CPU und der leistungsfähigen Custom-Chips originalgetreue Arcade-Portierungen ermöglichte. Capcom nutzte den X68000 sogar als Entwicklungsplattform für seine CPS-1-Arcade-Spiele, was zu nahezu perfekten Portierungen führte.",
        "Das auffällige Design des X68000 — ein futuristisches Doppeltower-Gehäuse — war ebenso unverwechselbar wie seine technischen Fähigkeiten. Die Hardware bot 65.536 Farben, Hardware-Sprites, Scrolling-Ebenen und FM-Sound — alles, was für Arcade-perfekte Umsetzungen nötig war. Street Fighter II, Gradius, Castlevania Chronicles und Final Fight gehörten zu den herausragenden Titeln.",
        "Der X68000 war ausschließlich in Japan erhältlich und blieb dort ein Nischenprodukt für Enthusiasten. Der hohe Preis (knapp 370.000 Yen beim Launch) beschränkte die Zielgruppe. Trotzdem genießt der X68000 heute Legendenstatus unter Retro-Computing-Fans als die Plattform mit den besten Arcade-Portierungen der 16-Bit-Ära."
      ],
    },
    facts: {
      unitsSold: "ca. 300.000 (geschätzt)",
      cpu: "Motorola MC68000 (10 MHz)",
      gameLibrary: { en: "600+ games and applications", de: "600+ Spiele und Anwendungen" },
      launchPrice: "369.000 Yen (1987)",
    },
    milestones: [
      { title: "Castlevania Chronicles", year: 1993, description: { en: "Standalone Castlevania exclusive to the X68000 — later ported to PS1", de: "Eigenständiges Castlevania exklusiv für den X68000 — später auf PS1 portiert" } },
      { title: "Street Fighter II' (X68000)", year: 1993, description: { en: "One of the most faithful ports of the arcade classic", de: "Eine der originalgetreuesten Portierungen des Arcade-Klassikers" } },
      { title: "Gradius II", year: 1992, description: { en: "Arcade-perfect port that fully utilized the hardware's capabilities", de: "Arcade-perfekte Portierung, die die Hardware-Fähigkeiten voll ausreizte" } },
    ],
  },

  // ── Arcade ──
  {
    platformId: "arcade",
    manufacturer: "Diverse (Namco, Capcom, Sega, SNK, Konami u.a.)",
    releaseYear: 1971,
    alternateNames: ["Spielhalle", "Coin-Op", "MAME", "FBNeo"],
    history: {
      en: [
        "The arcade was the birthplace of the video game industry. From Pong (1972) to Space Invaders (1978) to Street Fighter II (1991) — the greatest milestones in gaming history began as coin-operated machines. In the early '80s, the 'Golden Age of Arcades' reached its peak: Pac-Man became a global cultural phenomenon, and arcades were social gathering places for an entire generation.",
        "The 1990s brought the 3D revolution: Sega's Virtua Fighter (1993), Namco's Ridge Racer (1993), and Midway's Mortal Kombat (1992) demonstrated that arcade hardware was still years ahead of home consoles. Capcom dominated the fighting game genre with the CPS-2 system and the Street Fighter II series. SNK's Neo Geo MVS offered up to six games in a single cabinet.",
        "As home console power increased, arcades lost their relevance in Western countries by the late 1990s. In Japan, however, arcades remained an important part of gaming culture — to this day. MAME (Multiple Arcade Machine Emulator) and FBNeo digitally preserve the arcade heritage for future generations."
      ],
      de: [
        "Die Arcade-Spielhalle war der Geburtsort der Videospielindustrie. Von Pong (1972) über Space Invaders (1978) bis zu Street Fighter II (1991) — die größten Meilensteine der Spielegeschichte begannen als münzbetriebene Automaten. In den frühen 80ern erreichte die 'Arcade-Goldene-Ära' ihren Höhepunkt: Pac-Man wurde zum globalen Kulturphänomen, und Spielhallen waren soziale Treffpunkte für eine ganze Generation.",
        "Die 90er Jahre brachten die 3D-Revolution: Segas Virtua Fighter (1993), Namcos Ridge Racer (1993) und Midways Mortal Kombat (1992) zeigten, dass Arcade-Hardware den Heimkonsolen noch Jahre voraus war. Capcom dominierte mit dem CPS-2-System und der Street-Fighter-II-Serie das Fighting-Game-Genre. SNKs Neo Geo MVS bot bis zu sechs Spiele in einem Automaten.",
        "Mit steigender Leistung der Heimkonsolen verlor die Arcade ab Ende der 90er Jahre in westlichen Ländern an Bedeutung. In Japan blieben Spielhallen jedoch ein wichtiger Teil der Gaming-Kultur — bis heute. MAME (Multiple Arcade Machine Emulator) und FBNeo bewahren das Arcade-Erbe digital für zukünftige Generationen."
      ],
    },
    facts: {
      unitsSold: "Nicht anwendbar (Automaten-System)",
      cpu: "Variiert je nach Board (Z80, 68000, MIPS, ARM u.v.m.)",
      gameLibrary: { en: "Tens of thousands of games over 50+ years", de: "Zehntausende Spiele über 50+ Jahre" },
      launchPrice: "Variiert ($2.000-$25.000+ pro Automat)",
    },
    milestones: [
      { title: "Pac-Man", year: 1980, description: { en: "First gaming cultural phenomenon — generated over $2.5 billion in quarters", de: "Erstes Gaming-Kulturphänomen — generierte über 2,5 Milliarden Dollar in Münzen" } },
      { title: "Street Fighter II", year: 1991, description: { en: "Founded the modern fighting game genre and the tournament scene", de: "Begründete das moderne Fighting-Game-Genre und die Turnierszene" } },
      { title: "Space Invaders", year: 1978, description: { en: "Caused a 100-yen coin shortage in Japan — the first blockbuster video game", de: "Löste in Japan eine 100-Yen-Münz-Knappheit aus — das erste Blockbuster-Videospiel" } },
      { title: "Donkey Kong", year: 1981, description: { en: "Mario's debut and Shigeru Miyamoto's first masterpiece", de: "Debüt von Mario und Shigeru Miyamatos erstes Meisterwerk" } },
      { title: "Daytona USA", year: 1993, description: { en: "Sega's Model 2 milestone with unforgettable soundtrack and graphics", de: "Segas Model-2-Meilenstein mit unvergesslichem Soundtrack und Grafik" } },
    ],
  },
  {
    platformId: "naomi",
    manufacturer: "Sega",
    releaseYear: 1998,
    alternateNames: ["Sega NAOMI", "NAOMI 2", "NAOMI GD-ROM", "New Arcade Operation Machine for Interactive"],
    history: {
      en: [
        "The Sega NAOMI board was technically identical to the Dreamcast — but with twice the RAM (32 MB instead of 16 MB). This kinship enabled easy ports between arcade and home console, making the Dreamcast the ideal companion for arcade fans. NAOMI games could be delivered on ROM boards or GD-ROMs.",
        "The NAOMI platform was commercially very successful and ran in arcades worldwide from 1998 well into the 2000s. Titles like Crazy Taxi, Virtua Tennis, Marvel vs. Capcom 2, Ikaruga, and The House of the Dead 2 defined the late arcade era. The NAOMI 2 (2001) doubled the graphics power and offered games like Virtua Fighter 4 and Beach Spikers.",
        "NAOMI also served as the foundation for variants like the Sammy Atomiswave and the Sega Hikaru. The system proved that cost-effective, Dreamcast-based arcade hardware could produce highly profitable titles — many arcades used NAOMI boards well into the 2010s."
      ],
      de: [
        "Das Sega NAOMI-Board war technisch identisch mit dem Dreamcast — jedoch mit doppelt so viel Arbeitsspeicher (32 MB statt 16 MB). Dieses Verwandtschaftsverhältnis ermöglichte einfache Portierungen zwischen Arcade und Heimkonsole und machte den Dreamcast zum idealen Begleiter für Arcade-Fans. NAOMI-Spiele konnten auf ROM-Boards oder GD-ROMs ausgeliefert werden.",
        "Die NAOMI-Plattform war kommerziell äußerst erfolgreich und lief in Spielhallen weltweit von 1998 bis weit in die 2000er Jahre. Titel wie Crazy Taxi, Virtua Tennis, Marvel vs. Capcom 2, Ikaruga und The House of the Dead 2 definierten die späte Arcade-Ära. Das NAOMI 2 (2001) verdoppelte die Grafikleistung und bot Spiele wie Virtua Fighter 4 und Beach Spikers.",
        "NAOMI war auch die Basis für Varianten wie das Sammy Atomiswave und das Sega Hikaru. Das System bewies, dass kostengünstige, Dreamcast-basierte Arcade-Hardware hochprofitable Titel hervorbringen konnte — viele Spielhallen nutzten NAOMI-Boards bis in die 2010er Jahre."
      ],
    },
    facts: {
      unitsSold: "Arcade-System (weit verbreitet in Spielhallen weltweit)",
      cpu: "Hitachi SH4 (200 MHz, wie Dreamcast)",
      gameLibrary: { en: "170+ titles (NAOMI + NAOMI 2)", de: "170+ Titel (NAOMI + NAOMI 2)" },
      launchPrice: "Arcade-System",
    },
    milestones: [
      { title: "Marvel vs. Capcom 2", year: 2000, description: { en: "56 playable characters — one of the most popular fighting games of all time", de: "56 spielbare Charaktere — eines der beliebtesten Fighting Games aller Zeiten" } },
      { title: "Ikaruga", year: 2001, description: { en: "Treasure's masterpiece of the polarity shoot'em up genre", de: "Treasures Meisterwerk des Polaritäts-Shoot'em'up-Genres" } },
      { title: "Virtua Tennis", year: 1999, description: { en: "Defined the arcade tennis game with intuitive gameplay and addictive multiplayer", de: "Definierte das Arcade-Tennisspiel mit intuitivem Gameplay und suchterzeugendem Mehrspieler" } },
      { title: "Crazy Taxi", year: 1999, description: { en: "Pure arcade fun — later ported as a Dreamcast bestseller", de: "Arcade-Spaß pur — später als Dreamcast-Bestseller portiert" } },
    ],
  },
  {
    platformId: "atomiswave",
    manufacturer: "Sammy Corporation",
    releaseYear: 2003,
    alternateNames: ["Sammy Atomiswave", "AW"],
    history: {
      en: [
        "The Sammy Atomiswave was a cost-effective arcade system based on a modified Sega NAOMI architecture. Sammy had acquired the rights from Sega and developed a system that offered arcade operators a cheaper alternative to more expensive arcade boards. The Atomiswave used interchangeable ROM cartridges instead of GD-ROMs, further reducing costs.",
        "Despite its modest technical specifications, the Atomiswave hosted some noteworthy titles. SNK Playmore (the successor company to SNK) supported the platform with King of Fighters NeoWave, Samurai Shodown V, and Metal Slug 6. Sega's Fist of the North Star and Dolphin Blue also appeared on the system.",
        "The Atomiswave was primarily found in Japan and Asia, and was used in arcades until around 2008. Many Atomiswave titles were later ported to the Dreamcast and PS2 platforms. The system marked one of the last attempts to bring dedicated 2D arcade hardware to market before the arcade industry increasingly shifted to PC-based solutions."
      ],
      de: [
        "Das Sammy Atomiswave war ein kostengünstiges Arcade-System, das auf einer modifizierten Sega-NAOMI-Architektur basierte. Sammy hatte die Rechte von Sega erworben und ein System entwickelt, das Spielhallenbetreibern eine günstige Alternative zu teureren Arcade-Boards bot. Das Atomiswave nutzte austauschbare ROM-Cartridges statt GD-ROMs, was die Kosten weiter senkte.",
        "Trotz seiner bescheidenen technischen Spezifikationen beherbergte das Atomiswave einige bemerkenswerte Titel. SNK Playmore (die Nachfolgefirma von SNK) unterstützte die Plattform mit King of Fighters NeoWave, Samurai Shodown V und Metal Slug 6. Auch Segas Fist of the North Star und Dolphin Blue erschienen auf dem System.",
        "Das Atomiswave war vor allem in Japan und Asien verbreitet und wurde bis etwa 2008 in Spielhallen eingesetzt. Viele Atomiswave-Titel wurden später auf die Dreamcast- und PS2-Plattform portiert. Das System markierte einen der letzten Versuche, dedizierte 2D-Arcade-Hardware auf den Markt zu bringen, bevor die Arcade-Industrie zunehmend auf PC-basierte Lösungen umstieg."
      ],
    },
    facts: {
      unitsSold: "Arcade-System (begrenzte Verbreitung)",
      cpu: "Hitachi SH4 (200 MHz, NAOMI-basiert)",
      gameLibrary: { en: "27 official games", de: "27 offizielle Spiele" },
      launchPrice: "Arcade-System",
    },
    milestones: [
      { title: "Metal Slug 6", year: 2006, description: { en: "First Metal Slug on non-Neo Geo hardware with a new character selection system", de: "Erster Metal Slug auf nicht-Neo-Geo-Hardware mit neuem Charakter-Wahl-System" } },
      { title: "Samurai Shodown V", year: 2003, description: { en: "SNK Playmore's return to the beloved fighting game series", de: "SNK Playmores Rückkehr zur beliebten Kampfspiel-Serie" } },
      { title: "Dolphin Blue", year: 2003, description: { en: "Sega run'n'gun with underwater themes and classic arcade gameplay", de: "Sega-Run'n'Gun mit Unterwasser-Thematik und klassischem Arcade-Gameplay" } },
    ],
  },

  // ── Other ──
  {
    platformId: "scummvm",
    manufacturer: "LucasArts / Community-Projekt",
    releaseYear: 1987,
    alternateNames: ["ScummVM", "SCUMM", "Script Creation Utility for Maniac Mansion"],
    history: {
      en: [
        "SCUMM (Script Creation Utility for Maniac Mansion) was the revolutionary game engine that LucasArts developed in 1987 for Maniac Mansion. The point-and-click interface replaced the tedious typing of text commands with an intuitive verb bar that opened up the adventure genre to a broad audience. The SCUMM engine was refined over more than a decade and powered the greatest adventures in gaming history.",
        "From Maniac Mansion to The Secret of Monkey Island, Indiana Jones and the Fate of Atlantis, Day of the Tentacle, and The Curse of Monkey Island — SCUMM games defined the golden age of point-and-click adventures. Tim Schafer, Ron Gilbert, and Dave Grossman used these games to create stories that perfectly blended humor, puzzles, and emotion.",
        "ScummVM, the community project for emulating the SCUMM engine (and by now dozens of other adventure engines), makes these classics playable on modern systems. The open-source project now supports over 325 games from LucasArts, Sierra, Revolution Software, and many other studios. ScummVM is thus one of the most important contributions to preserving the adventure gaming heritage."
      ],
      de: [
        "SCUMM (Script Creation Utility for Maniac Mansion) war die revolutionäre Spiel-Engine, die LucasArts 1987 für Maniac Mansion entwickelte. Die Point-and-Click-Oberfläche ersetzte das mühsame Tippen von Textbefehlen durch eine intuitive Verben-Leiste, die das Adventure-Genre für ein breites Publikum öffnete. Die SCUMM-Engine wurde über ein Jahrzehnt weiterentwickelt und trieb die besten Adventures der Spielegeschichte an.",
        "Von Maniac Mansion über The Secret of Monkey Island, Indiana Jones and the Fate of Atlantis und Day of the Tentacle bis zu The Curse of Monkey Island — SCUMM-Spiele definierten das goldene Zeitalter der Point-and-Click-Adventures. Tim Schafer, Ron Gilbert und Dave Grossman schufen mit diesen Spielen Geschichten, die Humor, Rätsel und Emotion perfekt vereinten.",
        "ScummVM, das Community-Projekt zur Emulation der SCUMM-Engine (und mittlerweile dutzender weiterer Adventure-Engines), macht diese Klassiker auf modernen Systemen spielbar. Das Open-Source-Projekt unterstützt heute über 325 Spiele von LucasArts, Sierra, Revolution Software und vielen anderen Studios. ScummVM ist damit einer der wichtigsten Beiträge zur Bewahrung des Adventure-Erbes."
      ],
    },
    facts: {
      unitsSold: "Nicht anwendbar (Software-Engine/Emulator)",
      cpu: "Variiert je nach Hostplattform",
      gameLibrary: { en: "325+ supported games", de: "325+ unterstützte Spiele" },
      launchPrice: "Kostenlos (Open Source)",
    },
    milestones: [
      { title: "The Secret of Monkey Island", year: 1990, description: { en: "Ron Gilbert's masterpiece — defined the humorous point-and-click adventure", de: "Ron Gilberts Meisterwerk — definierte das humorvolle Point-and-Click-Adventure" } },
      { title: "Day of the Tentacle", year: 1993, description: { en: "Tim Schafer's time-travel comedy is considered one of the best adventures ever made", de: "Tim Schafers Zeitreise-Comedy gilt als eines der besten Adventures überhaupt" } },
      { title: "Grim Fandango", year: 1998, description: { en: "Film noir adventure in the Land of the Dead — artistically unique", de: "Film-Noir-Adventure im Land der Toten — künstlerisch einzigartig" } },
      { title: "ScummVM 1.0 Release", year: 2009, description: { en: "First stable release of the community project after eight years of development", de: "Erster stabiler Release des Community-Projekts nach acht Jahren Entwicklung" } },
      { title: "Indiana Jones and the Fate of Atlantis", year: 1992, description: { en: "Considered the best Indiana Jones adventure — better than some films in the franchise", de: "Gilt als das beste Indiana-Jones-Abenteuer — besser als mancher Film der Reihe" } },
    ],
  },
  {
    platformId: "pico8",
    manufacturer: "Lexaloffle Games (Joseph White)",
    releaseYear: 2015,
    alternateNames: ["PICO-8", "Fantasy Console"],
    history: {
      en: [
        "PICO-8 is a 'fantasy console' — a virtual game system with deliberate limitations that never existed as physical hardware. Developed by Joseph White (Lexaloffle Games), PICO-8 restricts games to a 128x128 pixel resolution, a fixed 16-color palette, 4-channel chiptune sound, and a maximum of 8,192 tokens of Lua code. These limitations are not a flaw — they are the feature.",
        "The deliberate constraints foster creativity through limitation. Developers must use every pixel, every note, and every line of code with care. The result is a vibrant community that has produced thousands of charming mini-games. PICO-8 games are saved as 'cartridges' embedded in PNG images — the code is hidden within the image itself.",
        "Celeste began as a PICO-8 prototype before becoming one of the most acclaimed indie games in history. The PICO-8 community gathers on the Lexaloffle forum and shares their creations. The fantasy console has inspired a new generation of game developers and proves that limitations are the best school for creativity."
      ],
      de: [
        "PICO-8 ist eine 'Fantasy Console' — ein virtuelles Spielsystem mit absichtlichen Limitierungen, das nie als physische Hardware existierte. Entwickelt von Joseph White (Lexaloffle Games), beschränkt PICO-8 Spiele auf 128x128 Pixel Auflösung, eine feste 16-Farben-Palette, 4-Kanal-Chiptune-Sound und maximal 8.192 Token Lua-Code. Diese Beschränkungen sind kein Fehler — sie sind das Feature.",
        "Die bewussten Limitierungen fördern Kreativität durch Begrenzung. Entwickler müssen jedes Pixel, jeden Ton und jede Codezeile mit Bedacht einsetzen. Das Ergebnis ist eine lebendige Community, die tausende charmanter Minispiele produziert hat. PICO-8-Spiele werden als 'Cartridges' in PNG-Bildern gespeichert — der Code ist im Bild selbst versteckt.",
        "Celeste begann als PICO-8-Prototyp, bevor es zu einem der meistgefeierten Indie-Spiele der Geschichte wurde. Die PICO-8-Community trifft sich auf dem Lexaloffle-Forum und teilt ihre Kreationen. Die Fantasy Console hat eine neue Generation von Spieleentwicklern inspiriert und beweist, dass Limitierungen die beste Kreativitätsschule sind."
      ],
    },
    facts: {
      unitsSold: "Nicht anwendbar (Virtuelle Konsole / Software)",
      cpu: "Virtueller Lua-basierter Prozessor",
      gameLibrary: { en: "Thousands of community games", de: "Tausende Community-Spiele" },
      launchPrice: "$14,99 (Software-Lizenz)",
    },
    milestones: [
      { title: "Celeste (PICO-8 Prototyp)", year: 2016, description: { en: "Original version of the later award-winning indie platformer", de: "Ursprungsversion des später preisgekrönten Indie-Plattformers" } },
      { title: "PICO-8 Zine", year: 2015, description: { en: "Community magazine featuring tutorials and game highlights", de: "Community-Magazin, das Tutorials und Spiele-Highlights präsentiert" } },
      { title: "Splore Browser", year: 2016, description: { en: "Built-in game browser for directly downloading and playing community games", de: "Eingebauter Spiele-Browser zum direkten Herunterladen und Spielen von Community-Spielen" } },
    ],
  },
  {
    platformId: "steam",
    manufacturer: "Valve Corporation",
    releaseYear: 2003,
    alternateNames: ["Steam", "Valve Steam"],
    history: {
      en: [
        "Steam began in 2003 as a simple update system for Counter-Strike and Half-Life 2 — and was initially hated by players. The requirement to sign up for Steam to play Half-Life 2 sparked a storm of outrage. But Gabe Newell, Valve co-founder, had a long-term vision: a central platform for digital game distribution.",
        "The turning point came with the Steam Sales. The legendary summer and winter sales with discounts of 50-90% changed the purchasing behavior of millions of players. Indie developers found a massive audience on Steam: games like Undertale, Stardew Valley, Hollow Knight, and Hades became million-sellers. The Steam Workshop enabled players to share mods directly through the platform.",
        "Today, Steam is the dominant PC gaming platform with over 30,000 games and more than 120 million monthly active users. The Steam Deck (2022) brought the Steam ecosystem to a handheld device. Valve's influence on the gaming industry through Steam can hardly be overstated — digital storefronts like Epic Games Store, GOG, and the PlayStation Store would be unthinkable without Steam's pioneering work."
      ],
      de: [
        "Steam begann 2003 als simples Update-System für Counter-Strike und Half-Life 2 — und wurde von Spielern zunächst gehasst. Die Pflicht, sich für Half-Life 2 bei Steam anzumelden, löste einen Sturm der Entrüstung aus. Doch Gabe Newell, Valve-Mitgründer, hatte eine langfristige Vision: eine zentrale Plattform für den digitalen Spielevertrieb.",
        "Der Wendepunkt kam mit den Steam Sales. Die legendären Sommer- und Winter-Sales mit Rabatten von 50-90% veränderten das Kaufverhalten von Millionen Spielern. Indie-Entwickler fanden auf Steam ein riesiges Publikum: Spiele wie Undertale, Stardew Valley, Hollow Knight und Hades wurden zu Millionensellern. Der Steam Workshop ermöglichte es Spielern, Mods direkt über die Plattform zu teilen.",
        "Heute ist Steam mit über 30.000 Spielen und über 120 Millionen monatlich aktiven Nutzern die dominante PC-Gaming-Plattform. Das Steam Deck (2022) brachte das Steam-Ökosystem auch auf einen Handheld. Valves Einfluss auf die Gaming-Industrie durch Steam ist kaum zu überschätzen — digitale Spieleläden wie Epic Games Store, GOG und der PlayStation Store wären ohne Steams Pionierarbeit undenkbar."
      ],
    },
    facts: {
      unitsSold: "120+ Millionen monatlich aktive Nutzer",
      cpu: "Nicht anwendbar (PC-Plattform)",
      gameLibrary: { en: "30,000+ games", de: "30.000+ Spiele" },
      launchPrice: "Kostenlos (Plattform)",
    },
    milestones: [
      { title: "Half-Life 2 (Steam-Pflicht)", year: 2004, description: { en: "Forced Steam installation — unpopular but strategically brilliant", de: "Erzwang Steam-Installation — unpopulär, aber strategisch brillant" } },
      { title: "Steam Sales", year: 2008, description: { en: "First major discount events changed digital game distribution forever", de: "Erste große Rabattaktionen veränderten den digitalen Spielevertrieb für immer" } },
      { title: "Steam Workshop", year: 2011, description: { en: "Enabled community mods directly through the platform", de: "Ermöglichte Community-Mods direkt über die Plattform" } },
      { title: "SteamOS / Steam Deck", year: 2022, description: { en: "Valve's Linux-based handheld brought the PC library into your pocket", de: "Valves Linux-basierter Handheld brachte die PC-Bibliothek in die Hosentasche" } },
      { title: "Proton (Steam Play)", year: 2018, description: { en: "Compatibility layer that made thousands of Windows games playable on Linux", de: "Kompatibilitätsschicht, die tausende Windows-Spiele unter Linux spielbar machte" } },
    ],
  },];

// ── Resolved types (what components receive) ──

export interface ResolvedConsoleMilestone {
  title: string;
  year: number;
  description: string;
}

export interface ResolvedConsoleFacts {
  unitsSold: string;
  cpu: string;
  gameLibrary: string;
  launchPrice: string;
}

export interface ResolvedConsoleHistoryEntry {
  platformId: string;
  manufacturer: string;
  releaseYear: number;
  alternateNames: string[];
  history: string[];
  facts: ResolvedConsoleFacts;
  milestones: ResolvedConsoleMilestone[];
}

type Language = "en" | "de";

function resolveEntry(entry: ConsoleHistoryEntry, lang: Language): ResolvedConsoleHistoryEntry {
  return {
    platformId: entry.platformId,
    manufacturer: entry.manufacturer,
    releaseYear: entry.releaseYear,
    alternateNames: entry.alternateNames,
    history: entry.history[lang],
    facts: {
      unitsSold: entry.facts.unitsSold,
      cpu: entry.facts.cpu,
      gameLibrary: entry.facts.gameLibrary[lang],
      launchPrice: entry.facts.launchPrice,
    },
    milestones: entry.milestones.map((m) => ({
      title: m.title,
      year: m.year,
      description: m.description[lang],
    })),
  };
}

const historyMap = new Map<string, ConsoleHistoryEntry>();
for (const entry of CONSOLE_HISTORY) {
  historyMap.set(entry.platformId, entry);
}

export function getConsoleHistory(platformId: string, lang: Language = "en"): ResolvedConsoleHistoryEntry | undefined {
  const entry = historyMap.get(platformId);
  if (!entry) return undefined;
  return resolveEntry(entry, lang);
}

export function getAllConsoleHistory(lang: Language = "en"): ResolvedConsoleHistoryEntry[] {
  return CONSOLE_HISTORY.map((e) => resolveEntry(e, lang));
}
