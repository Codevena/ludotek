// src/lib/console-history.ts

export interface ConsoleMilestone {
  title: string;
  year: number;
  description: string;
}

export interface ConsoleFacts {
  unitsSold: string;
  cpu: string;
  gameLibrary: string;
  launchPrice: string;
}

export interface ConsoleHistoryEntry {
  platformId: string;
  manufacturer: string;
  releaseYear: number;
  alternateNames: string[];
  history: string[];
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
    history: [
      "Als Gunpei Yokoi den Game Boy entwarf, waehrte er bewusst einen monochromen Bildschirm statt eines Farbdisplays. Diese Entscheidung wurde intern bei Nintendo heftig kritisiert — Konkurrenten wie der Atari Lynx und Segas Game Gear boten bereits Farbe. Doch Yokoi wusste: Ein monochromer Bildschirm verbrauchte weniger Strom, was laengere Spielzeiten und einen guenstigeren Preis ermoeglichte.",
      "Der entscheidende Coup war die Bundlung mit Tetris statt eines Mario-Spiels. Tetris sprach eine voellig neue Zielgruppe an — Erwachsene, Frauen, Gelegenheitsspieler. Der Game Boy wurde zum kulturellen Phaenomen: Auf Fluegen, in Wartezimmern und Schulpausen war er allgegenwaertig. Selbst im Golfkrieg 1991 nahmen Soldaten ihre Game Boys mit — ein Geraet ueberlebte einen Bombenangriff und funktionierte trotz geschmolzenem Gehaeuse weiter.",
      "Mit ueber 118 Millionen verkauften Einheiten (inklusive Game Boy Color) bewies Yokois Philosophie 'Laterales Denken mit veralteter Technologie', dass nicht rohe Leistung, sondern cleveres Design den Markt gewinnt. Dieses Prinzip praegte Nintendo bis heute — vom DS bis zur Switch."
    ],
    facts: {
      unitsSold: "118,69 Millionen (inkl. GBC)",
      cpu: "Sharp LR35902 (4,19 MHz)",
      gameLibrary: "1.046 offizielle Spiele",
      launchPrice: "12.500 Yen / $89,99 (1989)",
    },
    milestones: [
      { title: "Tetris", year: 1989, description: "Das Bundlespiel machte den Game Boy zum Massenprodukt und erreichte voellig neue Zielgruppen" },
      { title: "Pokemon Rot/Blau", year: 1996, description: "Loeste eine weltweite Sammelwut aus und rettete den Game Boy vor dem Ende seines Lebenszyklus" },
      { title: "Super Mario Land", year: 1989, description: "Bewies, dass vollwertige Mario-Abenteuer auch auf einem Handheld moeglich sind" },
      { title: "The Legend of Zelda: Link's Awakening", year: 1993, description: "Eines der ersten Handheld-Spiele mit einer tiefgruendigen, emotionalen Geschichte" },
      { title: "Game Boy Camera/Printer", year: 1998, description: "Machte den Game Boy zur ersten tragbaren Digitalkamera fuer den Massenmarkt" },
    ],
  },
  {
    platformId: "gbc",
    manufacturer: "Nintendo",
    releaseYear: 1998,
    alternateNames: ["Game Boy Color", "GBC", "CGB-001"],
    history: [
      "Der Game Boy Color war Nintendos Antwort auf die wachsende Kritik am veralteten Monochrom-Display des originalen Game Boy. Mit einem Farbbildschirm, der bis zu 56 Farben gleichzeitig darstellen konnte, bot er einen deutlichen visuellen Sprung — blieb aber gleichzeitig rueckwaertskompatibel mit dem gesamten Game-Boy-Katalog.",
      "Der wahre Erfolg des Game Boy Color war untrennbar mit Pokemon verbunden. Die Veroeffentlichung von Pokemon Gold und Silber im Jahr 2000 trieb die Verkaufszahlen in astronomische Hoehen. Das Spiel nutzte die neuen Faehigkeiten der Hardware geschickt aus — der Tag-Nacht-Zyklus in Echtzeit war fuer damalige Verhaeltnisse revolutionaer.",
      "Obwohl der GBC technisch nur ein inkrementelles Upgrade war, sicherte er Nintendos Dominanz im Handheld-Markt fuer weitere Jahre. Bis zum Erscheinen des Game Boy Advance 2001 hatte die Game-Boy-Familie insgesamt ueber 200 Millionen Einheiten verkauft — ein Rekord, der erst vom Nintendo DS gebrochen wurde."
    ],
    facts: {
      unitsSold: "49,02 Millionen",
      cpu: "Sharp LR35902 (8,39 MHz, doppelte Taktrate)",
      gameLibrary: "576 exklusive GBC-Spiele",
      launchPrice: "8.900 Yen / $79,99 (1998)",
    },
    milestones: [
      { title: "Pokemon Gold/Silber", year: 1999, description: "Fuehrte den Echtzeit-Tag-Nacht-Zyklus ein und verdoppelte die Spielwelt mit der Kanto-Region" },
      { title: "The Legend of Zelda: Oracle of Ages/Seasons", year: 2001, description: "Zwei miteinander verknuepfte Abenteuer, entwickelt von Capcom in Zusammenarbeit mit Nintendo" },
      { title: "Dragon Quest III (GBC)", year: 2000, description: "Bewies, dass umfangreiche RPGs auf dem kleinen Handheld hervorragend funktionieren" },
      { title: "Metal Gear Solid: Ghost Babel", year: 2000, description: "Eine vollwertige Metal-Gear-Erfahrung auf dem Handheld, die Kritiker begeisterte" },
    ],
  },
  {
    platformId: "gba",
    manufacturer: "Nintendo",
    releaseYear: 2001,
    alternateNames: ["Game Boy Advance", "GBA", "AGB-001"],
    history: [
      "Der Game Boy Advance war Nintendos erster 32-Bit-Handheld und brachte die Leistung eines Super Nintendo in die Hosentasche. Das Querformat-Design brach mit der vertikalen Tradition des Game Boy und bot ein breiteres Display, das sich besonders fuer Sidescroller und Rollenspiele eignete. Die Hardware war so leistungsfaehig, dass viele SNES-Klassiker nahezu perfekt portiert werden konnten.",
      "2003 erschien der GBA SP — ein ueberarbeitetes Modell mit Klappdesign und dem lang ersehnten beleuchteten Bildschirm. Dieses Redesign war ein Verkaufsschlager und verlaengerte den Lebenszyklus der Plattform erheblich. Nintendo bewies damit erneut sein Geschick, durch Hardware-Revisionen neue Kaufanreize zu schaffen.",
      "Der GBA wurde zur Heimat einiger der besten 2D-Spiele aller Zeiten. Von den Metroid-Remakes ueber die Golden-Sun-RPGs bis hin zu Fire Emblem, das erstmals den Sprung in den Westen schaffte — die Bibliothek war aussergewoehnlich vielfaeltig. Auch Drittanbieter wie Square Enix unterstuetzten die Plattform mit Titeln wie Final Fantasy Tactics Advance."
    ],
    facts: {
      unitsSold: "81,51 Millionen",
      cpu: "ARM7TDMI (16,78 MHz)",
      gameLibrary: "1.538 offizielle Spiele",
      launchPrice: "9.800 Yen / $99,99 (2001)",
    },
    milestones: [
      { title: "Pokemon Rubin/Saphir", year: 2002, description: "Fuehrte Faehigkeiten und Doppelkaempfe ein und verkaufte ueber 16 Millionen Einheiten" },
      { title: "Metroid Fusion", year: 2002, description: "Brachte das Metroid-Franchise zurueck und bot eine atmosphaerisch dichte Erfahrung" },
      { title: "Fire Emblem (Westen)", year: 2003, description: "Erstmalige Lokalisierung der Serie fuer westliche Maerkte — begruendete eine globale Fangemeinde" },
      { title: "Golden Sun", year: 2001, description: "RPG-Meisterwerk von Camelot mit beeindruckender Pseudo-3D-Grafik auf dem Handheld" },
      { title: "The Legend of Zelda: The Minish Cap", year: 2004, description: "Von Capcom entwickeltes Zelda-Abenteuer mit charmanter Schrumpf-Mechanik" },
    ],
  },
  {
    platformId: "nds",
    manufacturer: "Nintendo",
    releaseYear: 2004,
    alternateNames: ["Nintendo DS", "DS", "Dual Screen", "NTR-001"],
    history: [
      "Als Nintendo 2004 den DS ankuendigte, waren viele Beobachter skeptisch. Zwei Bildschirme? Ein Touchscreen? Ein Mikrofon? Das klang nach einem Gimmick, nicht nach einer Revolution. Doch Satoru Iwata, Nintendos damaliger Praesident, hatte eine klare Vision: Den Kreis der Spieler erweitern. Der DS sollte nicht nur Hardcore-Gamer ansprechen, sondern auch Menschen, die noch nie einen Controller in der Hand gehalten hatten.",
      "Diese Strategie ging spektakulaer auf. Brain Age, Nintendogs und Cooking Mama erreichten Millionen von Nichtspieler — aeltere Menschen, Frauen, Familien. In Japan wurde der DS zum gesellschaftlichen Phaenomen: Pendler spielten Brain Age in der U-Bahn, Familien versammelten sich um Nintendogs. Die Touchscreen-Steuerung machte Spiele intuitiv zugaenglich.",
      "Mit ueber 154 Millionen verkauften Einheiten wurde der DS zur meistverkauften tragbaren Konsole aller Zeiten und liegt in der Gesamtwertung nur hinter der PlayStation 2. Die enorme Bibliothek von ueber 1.800 Spielen umfasst alles von RPG-Meisterwerken wie Dragon Quest IX bis zu kreativen Perlen wie Elite Beat Agents."
    ],
    facts: {
      unitsSold: "154,02 Millionen",
      cpu: "ARM946E-S (67 MHz) + ARM7TDMI (33 MHz)",
      gameLibrary: "1.831 offizielle Spiele",
      launchPrice: "15.000 Yen / $149,99 (2004)",
    },
    milestones: [
      { title: "Nintendogs", year: 2005, description: "Virtuelles Haustier-Spiel, das den DS zum Mainstream-Phaenomen machte" },
      { title: "New Super Mario Bros.", year: 2006, description: "Wiederbelebung des 2D-Mario mit ueber 30 Millionen verkauften Einheiten" },
      { title: "Pokemon Diamant/Perl", year: 2006, description: "Erstes Pokemon der vierten Generation mit Online-Tausch ueber die Nintendo Wi-Fi Connection" },
      { title: "Professor Layton", year: 2007, description: "Charmante Raetsel-Serie von Level-5, die Puzzle und Erzaehlung meisterhaft verband" },
      { title: "Dragon Quest IX", year: 2009, description: "Ueber 5 Millionen Einheiten allein in Japan — das meistverkaufte DS-Spiel im Land" },
    ],
  },
  {
    platformId: "n3ds",
    manufacturer: "Nintendo",
    releaseYear: 2011,
    alternateNames: ["Nintendo 3DS", "3DS", "CTR-001"],
    history: [
      "Der Nintendo 3DS wagte etwas, das die gesamte Industrie fuer unmoeglich hielt: brillenloses 3D auf einem tragbaren Geraet. Die autostereoskopische Technologie erzeugte einen ueberzeugenden Tiefeneffekt, der bei der ersten E3-Praesentation 2010 fuer Staunen sorgte. Doch der Launch im Maerz 2011 war holprig — der hohe Preis von $249 und das duenne Startsortiment fuehrten zu enttaeuschenden Verkaufszahlen.",
      "Nintendo reagierte drastisch: Nur fuenf Monate nach dem Launch senkte man den Preis um ein Drittel auf $169. Fruehkaeufer erhielten als Entschaedigung 20 kostenlose Virtual-Console-Spiele ueber das 'Ambassador-Programm'. Dieser aggressive Schritt, kombiniert mit Blockbuster-Titeln wie Super Mario 3D Land und Mario Kart 7, wendete das Blatt.",
      "2014 erschien der 'New Nintendo 3DS' mit verbessertem 3D-Tracking, das die Blickwinkel-Probleme des Originals loeste, sowie einem C-Stick und zusaetzlichen Schultertasten. Der 3DS wurde zur Heimat herausragender First-Party-Titel und entwickelte sich zu einer der staerksten Nintendo-Plattformen — trotz der wachsenden Konkurrenz durch Smartphones."
    ],
    facts: {
      unitsSold: "75,94 Millionen",
      cpu: "ARM11 MPCore (268 MHz, Dual-Core)",
      gameLibrary: "1.340+ Spiele",
      launchPrice: "25.000 Yen / $249,99 (2011)",
    },
    milestones: [
      { title: "Super Mario 3D Land", year: 2011, description: "Verschmolz 2D- und 3D-Mario-Gameplay und nutzte den 3D-Effekt genial fuer Raetsel" },
      { title: "Pokemon X/Y", year: 2013, description: "Erster vollstaendig dreidimensionaler Pokemon-Hauptteil mit weltweitem Simultanrelease" },
      { title: "The Legend of Zelda: A Link Between Worlds", year: 2013, description: "Brillante Neuinterpretation von A Link to the Past mit innovativer Wand-Mechanik" },
      { title: "Fire Emblem: Awakening", year: 2012, description: "Rettete die Fire-Emblem-Serie vor der Einstellung und machte sie zum Mainstream-Hit" },
      { title: "Monster Hunter 4 Ultimate", year: 2014, description: "Definierte das kooperative Handheld-Erlebnis und verkaufte Millionen in Japan" },
    ],
  },
  {
    platformId: "virtualboy",
    manufacturer: "Nintendo",
    releaseYear: 1995,
    alternateNames: ["Virtual Boy", "VUE-001"],
    history: [
      "Der Virtual Boy war Gunpei Yokois letztes Projekt bei Nintendo — und sein groesster kommerzieller Misserfolg. Die Idee war visionaer: ein tragbares Virtual-Reality-System fuer den Massenmarkt. Doch technische Limitierungen und Kosteneinschraenkungen fuehrten zu einem Geraet, das in keiner Kategorie ueberzeugte. Der monochrome rote LED-Display verursachte bei vielen Nutzern Kopfschmerzen und Uebelkeit.",
      "Das Design war weder tragbar noch stationaer — der Spieler musste in ein auf einem Staender montiertes Geraet schauen, in einer unbequemen Haltung. Der 3D-Effekt war zwar beeindruckend, aber das Fehlen von Farbe und die ergonomischen Probleme machten laengere Spielsitzungen zur Qual. Nintendo versuchte, den Virtual Boy als Brueckenprodukt zwischen Game Boy und dem kommenden N64 zu positionieren, doch diese Strategie ging nicht auf.",
      "Nach nur sechs Monaten und 22 veroeffentlichten Spielen stellte Nintendo die Produktion ein. Der Virtual Boy verkaufte nur 770.000 Einheiten — weniger als jedes andere Nintendo-Produkt. Trotzdem ist er heute ein begehrtes Sammlerstueck, und einige Spiele wie Virtual Boy Wario Land gelten als versteckte Juwelen."
    ],
    facts: {
      unitsSold: "770.000",
      cpu: "NEC V810 (20 MHz)",
      gameLibrary: "22 offizielle Spiele",
      launchPrice: "15.000 Yen / $179,95 (1995)",
    },
    milestones: [
      { title: "Mario's Tennis", year: 1995, description: "Das Bundlespiel demonstrierte den 3D-Effekt am besten, war aber inhaltlich duenn" },
      { title: "Virtual Boy Wario Land", year: 1995, description: "Das beste Spiel der Plattform — ein vollwertiges Jump'n'Run mit cleverem 3D-Einsatz" },
      { title: "Red Alarm", year: 1995, description: "Drahtgitter-Shooter, der die 3D-Faehigkeiten der Hardware am eindrucksvollsten nutzte" },
    ],
  },
  {
    platformId: "pokemini",
    manufacturer: "Nintendo / The Pokemon Company",
    releaseYear: 2001,
    alternateNames: ["Pokemon Mini", "PM"],
    history: [
      "Der Pokemon Mini war die kleinste Spielkonsole mit Steckmodulen, die jemals produziert wurde. Mit Abmessungen von nur 74 x 58 x 23 mm passte er problemlos in jede Kinderhand. Nintendo entwickelte das Geraet speziell als Pokemon-Lizenzprodukt fuer juengere Spieler — eine Nische zwischen Spielzeug und Spielkonsole.",
      "Trotz seiner winzigen Groesse bot der Pokemon Mini ueberraschend viele Features: einen Bewegungssensor, einen Infrarot-Port fuer Multiplayer, einen Vibrationsmotor und sogar eine eingebaute Echtzeituhr. Das monochrome Display hatte eine Aufloesung von nur 96 x 64 Pixeln, aber die Spiele nutzten diese Limitierung kreativ aus.",
      "Kommerziell war der Pokemon Mini kein Erfolg — es erschienen nur zehn Spiele, und das Geraet wurde ausserhalb Japans kaum beworben. In der Homebrew-Szene erfreut er sich jedoch bis heute einer treuen Fangemeinde, die neue Spiele und Tools fuer die Plattform entwickelt."
    ],
    facts: {
      unitsSold: "Unbekannt (geringe Stueckzahl)",
      cpu: "Epson S1C88 (4 MHz)",
      gameLibrary: "10 offizielle Spiele",
      launchPrice: "4.980 Yen / $34,99 (2001)",
    },
    milestones: [
      { title: "Pokemon Party Mini", year: 2001, description: "Bundlespiel mit Minispielen, das den Bewegungssensor und Vibrationsmotor demonstrierte" },
      { title: "Pokemon Puzzle Collection", year: 2001, description: "Puzzle-Sammlung, die das Beste aus dem winzigen Display herausholte" },
      { title: "Pokemon Zany Cards", year: 2001, description: "Kartenspiel mit ueberraschender strategischer Tiefe" },
    ],
  },

  // ── Nintendo Home Consoles ──
  {
    platformId: "nes",
    manufacturer: "Nintendo",
    releaseYear: 1983,
    alternateNames: ["Famicom (Japan)", "NES (Nordamerika/Europa)"],
    history: [
      "Nach dem verheerenden Videospiel-Crash von 1983 lag die nordamerikanische Spieleindustrie in Truemmern. Atari hatte den Markt mit minderwertigen Titeln ueberschwemmt — das Vertrauen der Konsumenten und Haendler war zerstoert. In Japan hingegen arbeitete Nintendo an einer Konsole, die alles veraendern sollte: dem Family Computer, kurz Famicom.",
      "Hiroshi Yamauchi, Nintendos visionaerer Praesident, fuehrte das 'Nintendo Seal of Quality' ein — ein Qualitaetssiegel, das sicherstellte, dass nur von Nintendo gepruuefte Spiele auf der Plattform erscheinen durften. Entwickler durften maximal fuenf Titel pro Jahr veroeffentlichen. Diese strenge Kontrolle rettete nicht nur Nintendo, sondern die gesamte Videospielindustrie.",
      "In Nordamerika wurde das Famicom als 'Nintendo Entertainment System' vermarktet — bewusst als 'Entertainment System' statt 'Videospielkonsole', um die negativen Assoziationen des Crashs zu umgehen. Der Trick funktionierte: Bis 1990 stand ein NES in jedem dritten amerikanischen Haushalt."
    ],
    facts: {
      unitsSold: "61,91 Millionen",
      cpu: "Ricoh 2A03 (1,79 MHz)",
      gameLibrary: "716 offizielle Spiele",
      launchPrice: "14.800 Yen / $179 (1985)",
    },
    milestones: [
      { title: "Super Mario Bros.", year: 1985, description: "Definierte das Jump'n'Run-Genre und wurde zum meistverkauften Spiel seiner Zeit" },
      { title: "The Legend of Zelda", year: 1986, description: "Erfand das Action-Adventure-Genre mit offener Welt und Battery-Save" },
      { title: "Metroid", year: 1986, description: "Pionierin der nicht-linearen Exploration — Samus Aran war eine der ersten weiblichen Protagonistinnen" },
      { title: "Mega Man 2", year: 1988, description: "Perfektionierte die Boss-Rush-Formel und wurde zum Synonym fuer forderndes Leveldesign" },
      { title: "Final Fantasy", year: 1987, description: "Rettete Square vor dem Bankrott und begruendete eine der groessten RPG-Serien" },
    ],
  },
  {
    platformId: "snes",
    manufacturer: "Nintendo",
    releaseYear: 1990,
    alternateNames: ["Super Famicom (Japan)", "Super NES", "SNES"],
    history: [
      "Das Super Nintendo erschien 1990 in Japan als Nachfolger des ueberaus erfolgreichen Famicom. Mit dem 16-Bit-Prozessor, dem revolutionaeren Mode-7-Grafikchip fuer Rotations- und Skalierungseffekte und einem herausragenden Soundchip von Sony (ja, Sony!) setzte es neue Massstaebe. Der Soundchip wurde uebrigens von Ken Kutaragi entwickelt — dem Mann, der spaeter die PlayStation erschaffen sollte.",
      "Die Rivalitaet zwischen Nintendo und Sega praegte die fruehen 90er Jahre. 'Sega does what Nintendon't' lautete Segas aggressive Werbekampagne. Doch waehrend der Mega Drive/Genesis in Nordamerika zeitweise fuehrte, gewann Nintendo den Krieg der Softwarequalitaet: Super Mario World, A Link to the Past, Super Metroid und Chrono Trigger zaehlen bis heute zu den besten Spielen aller Zeiten.",
      "Das SNES war auch die Heimat einer goldenen Aera der japanischen RPGs. Square veroeffentlichte Final Fantasy IV, V und VI, Chrono Trigger und Secret of Mana — allesamt Meisterwerke, die das Genre fuer immer praegten. Enix konterte mit Dragon Quest V und VI. Diese kreative Bluetezeit ist bis heute unerreicht."
    ],
    facts: {
      unitsSold: "49,10 Millionen",
      cpu: "Ricoh 5A22 (3,58 MHz)",
      gameLibrary: "1.757 offizielle Spiele",
      launchPrice: "25.000 Yen / $199 (1991)",
    },
    milestones: [
      { title: "Super Mario World", year: 1990, description: "Launch-Titel und eines der perfektesten Jump'n'Runs aller Zeiten — fuehrte Yoshi ein" },
      { title: "The Legend of Zelda: A Link to the Past", year: 1991, description: "Definierte die Zelda-Formel mit Licht-/Schattenwelt und Dungeon-Design" },
      { title: "Super Metroid", year: 1994, description: "Gilt als eines der bestdesignten Spiele ueberhaupt — Meister der Atmosphaere" },
      { title: "Chrono Trigger", year: 1995, description: "Dream-Team aus Square, Akira Toriyama und Yuji Horii schuf ein zeitloses RPG-Meisterwerk" },
      { title: "Donkey Kong Country", year: 1994, description: "Rares vorgerendertes 3D-Grafik war technisch bahnbrechend und rettete das SNES vor dem 32-Bit-Ansturm" },
    ],
  },
  {
    platformId: "n64",
    manufacturer: "Nintendo",
    releaseYear: 1996,
    alternateNames: ["Nintendo 64", "N64", "Ultra 64", "Project Reality"],
    history: [
      "Das Nintendo 64 war ein technisches Kraftpaket, das seiner Zeit voraus war — und gleichzeitig eine folgenschwere Fehlentscheidung traf. Waehrend Sony und Sega auf CD-ROMs setzten, blieb Nintendo bei Modulen (Cartridges). Die Vorteile waren schnelle Ladezeiten und Robustheit, doch die Nachteile wogen schwerer: Module waren teurer in der Produktion, boten weniger Speicherplatz und vergraulten Drittanbieter wie Square, die zu Sony wechselten.",
      "Trotzdem lieferte Nintendo einige der einflussreichsten Spiele der Videospielgeschichte. Super Mario 64 definierte, wie 3D-Spiele funktionieren — die analoge Steuerung mit dem revolutionaeren Analog-Stick setzte den Standard fuer alle nachfolgenden 3D-Titel. The Legend of Zelda: Ocarina of Time gilt bis heute als eines der besten Spiele aller Zeiten. GoldenEye 007 bewies, dass Ego-Shooter auch auf Konsolen funktionieren koennen.",
      "Der N64 war auch die Konsole, die Mehrspieler-Abende praegte wie keine andere. Vier Controller-Anschluesse waren serienmaessig verbaut — ein Novum. Mario Kart 64, Super Smash Bros. und Mario Party wurden zu den ultimativen Partyspielen und schufen Erinnerungen, die eine ganze Generation praegte."
    ],
    facts: {
      unitsSold: "32,93 Millionen",
      cpu: "NEC VR4300 (93,75 MHz)",
      gameLibrary: "388 offizielle Spiele",
      launchPrice: "25.000 Yen / $199,99 (1996)",
    },
    milestones: [
      { title: "Super Mario 64", year: 1996, description: "Revolutionierte 3D-Gaming und definierte die analoge Steuerung fuer alle kommenden Generationen" },
      { title: "The Legend of Zelda: Ocarina of Time", year: 1998, description: "Gilt als eines der einflussreichsten Spiele aller Zeiten — fuehrte Z-Targeting ein" },
      { title: "GoldenEye 007", year: 1997, description: "Bewies, dass Ego-Shooter auf Konsolen funktionieren und definierte den Splitscreen-Multiplayer" },
      { title: "Super Smash Bros.", year: 1999, description: "Begruendete das Crossover-Kampfspiel-Genre mit Nintendo-Charakteren" },
      { title: "The Legend of Zelda: Majora's Mask", year: 2000, description: "Innovatives Drei-Tages-Zeitschleifen-System und die dunkelste Zelda-Geschichte" },
    ],
  },
  {
    platformId: "gc",
    manufacturer: "Nintendo",
    releaseYear: 2001,
    alternateNames: ["GameCube", "NGC", "DOL-001"],
    history: [
      "Der GameCube war Nintendos erster Schritt weg von Modulen hin zu optischen Datentraegern — allerdings nicht zu Standard-DVDs, sondern zu proprietaeren Mini-Discs. Diese Entscheidung verhinderte DVD-Wiedergabe und aergerte Drittanbieter, die ihre Spiele auf mehrere Discs aufteilen mussten. In einer Generation, die von der PlayStation 2 dominiert wurde, hatte es der GameCube schwer.",
      "Was dem GameCube an Marktanteil fehlte, machte er mit Spielequalitaet wett. Metroid Prime bewies, dass die Metroid-Formel auch in der Ego-Perspektive funktioniert. The Wind Waker wagte einen mutigen Cel-Shading-Kunststil, der anfangs kritisiert, aber spaeter als zeitlos gefeiert wurde. Resident Evil 4, urspruenglich als GameCube-Exklusivtitel geplant, gilt als einer der einflussreichsten Action-Titel ueberhaupt.",
      "Der GameCube fuehrte auch den GBA-Link-Kabel-Anschluss ein, der innovative Gameplay-Moeglichkeiten bot — etwa in The Legend of Zelda: Four Swords Adventures oder Final Fantasy Crystal Chronicles. Obwohl kommerziell hinter PS2 und Xbox zurueck, geniesst der GameCube heute Kultstatus und seine Spiele erzielen hohe Sammlerpreise."
    ],
    facts: {
      unitsSold: "21,74 Millionen",
      cpu: "IBM Gekko (485 MHz)",
      gameLibrary: "653 offizielle Spiele",
      launchPrice: "25.000 Yen / $199,99 (2001)",
    },
    milestones: [
      { title: "Super Smash Bros. Melee", year: 2001, description: "Meistverkauftes GameCube-Spiel und bis heute aktiv in der kompetitiven Fighting-Game-Szene" },
      { title: "Metroid Prime", year: 2002, description: "Meisterhafter Genrewechsel von 2D zu First-Person — ein Meilenstein des Gamedesigns" },
      { title: "The Legend of Zelda: The Wind Waker", year: 2002, description: "Mutiger Cel-Shading-Stil, der anfangs polarisierte, heute als zeitloser Klassiker gilt" },
      { title: "Resident Evil 4", year: 2005, description: "Revolutionierte das Action-Genre mit der Ueber-die-Schulter-Kamera" },
      { title: "Paper Mario: Die Legende vom Aeonentor", year: 2004, description: "Eines der charmantesten RPGs der Generation mit einzigartigem Papier-Kunststil" },
    ],
  },
  {
    platformId: "wii",
    manufacturer: "Nintendo",
    releaseYear: 2006,
    alternateNames: ["Nintendo Wii", "Revolution (Codename)"],
    history: [
      "Die Wii war Nintendos kuehnstes Experiment — und ihr groesster kommerzieller Erfolg in der Konsolengeschichte. Statt sich auf einen Leistungswettlauf mit Sony und Microsoft einzulassen, setzte Nintendo auf Bewegungssteuerung. Der Wii Remote Controller mit seinem Beschleunigungssensor und Infrarot-Zeiger machte Videospiele fuer alle zugaenglich: Grosseltern bowlten, Familien spielten Tennis, und Fitnessbegeisterte trainierten mit Wii Fit.",
      "Wii Sports, das in den meisten Regionen als Bundlespiel beilag, wurde zum Kulturphaenomen. Es war das Spiel, das Nicht-Spieler zum Spielen brachte. Altenheime richteten Wii-Bowling-Turniere ein, Physiotherapeuten setzten die Konsole in der Rehabilitation ein. Die Wii stand nicht mehr nur im Kinderzimmer — sie stand im Wohnzimmer, im Gemeinschaftsraum, im Buero.",
      "Trotz der schwaechen Hardware (im Grunde ein leicht aufgebohrter GameCube) verkaufte sich die Wii ueber 101 Millionen Mal. Allerdings verlor sie gegen Ende ihres Lebenszyklus an Schwung — Hardcore-Gamer fuhlten sich vernachlaessigt, und der Strom an Casual-Spielen liess nach. Dennoch bewies die Wii, dass Innovation wichtiger ist als rohe Rechenleistung."
    ],
    facts: {
      unitsSold: "101,63 Millionen",
      cpu: "IBM Broadway (729 MHz)",
      gameLibrary: "1.637 offizielle Spiele",
      launchPrice: "25.000 Yen / $249,99 (2006)",
    },
    milestones: [
      { title: "Wii Sports", year: 2006, description: "Meistverkauftes Einzelspiel einer Konsole — machte Bewegungssteuerung zum Mainstream" },
      { title: "Super Mario Galaxy", year: 2007, description: "Revolutionierte 3D-Plattformer mit Schwerkraft-Mechanik und planetarem Leveldesign" },
      { title: "Wii Fit", year: 2007, description: "Fitness-Spiel mit Balance Board verkaufte ueber 22 Millionen Einheiten weltweit" },
      { title: "The Legend of Zelda: Skyward Sword", year: 2011, description: "Erstes Zelda mit praeziser 1:1-Bewegungssteuerung dank Wii MotionPlus" },
      { title: "Super Smash Bros. Brawl", year: 2008, description: "Fuehrte Online-Multiplayer ein und erweiterte den Roster um Gastcharaktere wie Solid Snake" },
    ],
  },
  {
    platformId: "wiiu",
    manufacturer: "Nintendo",
    releaseYear: 2012,
    alternateNames: ["Wii U", "Project Cafe (Codename)"],
    history: [
      "Die Wii U war Nintendos groesster kommerzieller Misserfolg seit dem Virtual Boy. Das Kernproblem: Kaum jemand verstand das Produkt. Der Tablet-aehnliche GamePad-Controller mit integriertem Bildschirm war innovativ, aber die Vermarktung scheiterte daran, klar zu kommunizieren, dass es sich um eine neue Konsole handelte — viele hielten ihn fuer ein Zubehoer der Wii.",
      "Hinzu kam ein katastrophaler Softwaremangel zum Launch und fehlende Unterstuetzung durch Drittanbieter. Die schwache Hardware konnte nicht mit der PlayStation 4 oder Xbox One mithalten, und die Online-Infrastruktur blieb hinter der Konkurrenz zurueck. Nintendo kaempfte verzweifelt darum, die Plattform relevant zu halten.",
      "Trotz des kommerziellen Misserfolgs bot die Wii U einige der besten Nintendo-Spiele ueberhaupt. Super Mario 3D World, Splatoon, Bayonetta 2 und The Legend of Zelda: Breath of the Wild (das auch auf der Switch erschien) zeigten, dass Nintendos Spieleentwicklung erstklassig blieb. Viele Wii-U-Titel wurden spaeter als 'Deluxe'-Versionen auf die Switch portiert und fanden dort endlich ihr Publikum."
    ],
    facts: {
      unitsSold: "13,56 Millionen",
      cpu: "IBM Espresso (1,24 GHz, Tri-Core)",
      gameLibrary: "791 offizielle Spiele",
      launchPrice: "26.250 Yen / $299,99 (2012)",
    },
    milestones: [
      { title: "Splatoon", year: 2015, description: "Nintendos erste neue IP seit Jahren — frischer Team-Shooter mit einzigartigem Farb-Konzept" },
      { title: "Super Mario 3D World", year: 2013, description: "Brillanter Koop-Plattformer mit dem Katzen-Powerup und kreativem Leveldesign" },
      { title: "Mario Kart 8", year: 2014, description: "Fuehrte Antigravitations-Strecken ein — das meistverkaufte Wii-U-Spiel" },
      { title: "Super Smash Bros. for Wii U", year: 2014, description: "HD-Debuet der Serie mit dem bisher groessten Kaempfer-Roster" },
      { title: "Bayonetta 2", year: 2014, description: "Von Nintendo finanziertes Action-Meisterwerk, das ohne ihre Unterstuetzung nie erschienen waere" },
    ],
  },
  {
    platformId: "switch",
    manufacturer: "Nintendo",
    releaseYear: 2017,
    alternateNames: ["Nintendo Switch", "NX (Codename)"],
    history: [
      "Die Nintendo Switch war Nintendos Antwort auf den Wii-U-Misserfolg — und sie war brillant einfach. Die Idee: Eine Konsole, die sowohl stationaer am Fernseher als auch unterwegs als Handheld funktioniert. Dieses Hybrid-Konzept war die logische Schlussfolgerung aus Nintendos Geschichte mit Heimkonsolen und Handhelds. Statt zwei separate Maerkte zu bedienen, vereinte man sie in einem Geraet.",
      "Der Launch im Maerz 2017 wurde von The Legend of Zelda: Breath of the Wild begleitet — einem Spiel, das die Open-World-Formel neu definierte und universelle Bestnoten erhielt. Super Mario Odyssey folgte im Oktober und bewies, dass Nintendo gleich zwei Meisterwerke im selben Jahr liefern konnte. Die Switch-Euphorie war grenzenlos.",
      "Die Switch wurde auch zur Heimat einer bluehenden Indie-Szene. Spiele wie Hollow Knight, Celeste und Stardew Valley fanden auf der tragbaren Konsole ihr ideales Zuhause. Mit ueber 140 Millionen verkauften Einheiten ueberholte die Switch die Wii und den Game Boy und wurde zu einer der meistverkauften Konsolen aller Zeiten."
    ],
    facts: {
      unitsSold: "143,42 Millionen (Stand 2024)",
      cpu: "NVIDIA Tegra X1 (1,02 GHz)",
      gameLibrary: "5.000+ Spiele",
      launchPrice: "29.980 Yen / $299,99 (2017)",
    },
    milestones: [
      { title: "The Legend of Zelda: Breath of the Wild", year: 2017, description: "Revolutionierte das Open-World-Genre mit vollstaendiger Freiheit und physikbasiertem Gameplay" },
      { title: "Super Mario Odyssey", year: 2017, description: "Feierte die gesamte Mario-Geschichte mit der genialen Cappy-Verwandlungsmechanik" },
      { title: "Animal Crossing: New Horizons", year: 2020, description: "Wurde waehrend der COVID-Pandemie zum globalen sozialen Treffpunkt" },
      { title: "Splatoon 3", year: 2022, description: "Ueber 3,45 Millionen Einheiten am ersten Wochenende allein in Japan" },
      { title: "The Legend of Zelda: Tears of the Kingdom", year: 2023, description: "Baute mit dem Ultrahand-System auf BotW auf und liess Spieler nahezu alles bauen" },
    ],
  },

  // ── Sega ──
  {
    platformId: "sg1000",
    manufacturer: "Sega",
    releaseYear: 1983,
    alternateNames: ["SG-1000", "Sega Game 1000"],
    history: [
      "Der SG-1000 war Segas allererste Heimkonsole und erschien am selben Tag wie Nintendos Famicom — dem 15. Juli 1983. Dieser Zufall sollte den Beginn einer jahrzehntelangen Rivalitaet markieren. Sega, urspruenglich ein Unternehmen fuer Arcade-Automaten, wagte mit dem SG-1000 den Schritt in den Heimkonsolenmarkt.",
      "Technisch war der SG-1000 dem Famicom unterlegen und konnte im japanischen Markt nicht mithalten. Die Spielebibliothek bestand groesstenteils aus Arcade-Portierungen wie Congo Bongo und Star Jacker. Trotzdem legte der SG-1000 den Grundstein fuer Segas Konsolengeschaeft und fuehrte 1984 zur verbesserten Version SG-1000 II.",
      "Ausserhalb Japans war der SG-1000 kaum erhaeltlich, wurde aber in einigen asiatischen Laendern und Australien (als Lizenzversion) verkauft. Seine wahre Bedeutung liegt darin, dass er Sega den Einstieg in den Konsolenmarkt ermoeglichte — ohne den SG-1000 haette es kein Master System und keinen Mega Drive gegeben."
    ],
    facts: {
      unitsSold: "Geschaetzt 2 Millionen (inkl. Varianten)",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: "74 offizielle Spiele",
      launchPrice: "15.000 Yen (1983)",
    },
    milestones: [
      { title: "Congo Bongo", year: 1983, description: "Isometrischer Arcade-Port, der die Faehigkeiten der Hardware demonstrierte" },
      { title: "Girl's Garden", year: 1984, description: "Eines der ersten Spiele von Yuji Naka — dem spaeteren Schoepfer von Sonic the Hedgehog" },
      { title: "SG-1000 II", year: 1984, description: "Ueberarbeitete Version mit abnehmbarem Controller und besserem Design" },
    ],
  },
  {
    platformId: "mastersystem",
    manufacturer: "Sega",
    releaseYear: 1985,
    alternateNames: ["Sega Master System", "Mark III (Japan)", "SMS"],
    history: [
      "Das Sega Master System war Segas zweiter Versuch im Heimkonsolenmarkt und technisch dem NES in vielen Bereichen ueberlegen — mehr Farben, besserer Sound, leistungsfaehigere Hardware. Doch in Japan und Nordamerika konnte es Nintendos Wuergegriff auf den Markt nicht brechen. Nintendos restriktive Lizenzvertraege verhinderten, dass viele Drittanbieter Spiele fuer die Konkurrenz entwickelten.",
      "Waehrend das Master System in Japan und den USA floepte, wurde es in Europa und Brasilien zum ueberragenden Erfolg. In Brasilien, wo Nintendo keinen offiziellen Vertrieb hatte, dominierte das Master System den Markt fast vollstaendig. Die brasilianische Firma Tec Toy produziert bis heute Varianten des Master Systems — es ist die am laengsten kontinuierlich produzierte Spielkonsole der Welt.",
      "Das Master System bot einige herausragende Spiele, darunter Phantasy Star — eines der ersten RPGs mit Ego-Perspektive in Dungeons und einer weiblichen Hauptfigur. Alex Kidd, Segas urspruengliches Maskottchen vor Sonic, hatte hier seinen Ursprung. Wonder Boy, Shinobi und Fantasy Zone rundeten eine solide Bibliothek ab."
    ],
    facts: {
      unitsSold: "13 Millionen (geschaetzt)",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: "318 offizielle Spiele",
      launchPrice: "20.000 Yen / $200 (1986)",
    },
    milestones: [
      { title: "Phantasy Star", year: 1987, description: "Bahnbrechendes RPG mit weiblicher Protagonistin und 3D-Dungeons — Segas Antwort auf Final Fantasy" },
      { title: "Alex Kidd in Miracle World", year: 1986, description: "Segas erstes Maskottchen-Spiel — in vielen Regionen ins System integriert" },
      { title: "Wonder Boy III: The Dragon's Trap", year: 1989, description: "Innovatives Action-RPG mit Verwandlungsmechanik — 2017 als Remake zurueckgekehrt" },
      { title: "Sonic the Hedgehog (SMS)", year: 1991, description: "Eigenstaendige 8-Bit-Version, die die technischen Grenzen des Master Systems ausreizte" },
    ],
  },
  {
    platformId: "megadrive",
    manufacturer: "Sega",
    releaseYear: 1988,
    alternateNames: ["Mega Drive (Japan/Europa)", "Genesis (Nordamerika)"],
    history: [
      "Der Sega Mega Drive war die Konsole, mit der Sega endlich Nintendo die Stirn bot. In Nordamerika als 'Genesis' vermarktet, setzte Sega auf aggressive Werbung mit dem legendaeren Slogan 'Genesis does what Nintendon't'. Die 16-Bit-Konsole erschien zwei Jahre vor dem Super Nintendo und nutzte diesen Vorsprung geschickt aus.",
      "Der entscheidende Moment kam 1991 mit Sonic the Hedgehog. Der blaue Igel wurde zu Segas Maskottchen und zum Inbegriff von Geschwindigkeit und Coolness — ein bewusster Kontrast zu Nintendos familienfreundlichem Mario. Sonic 2 verkaufte am Erscheinungstag, dem 'Sonic 2sday' (einem Dienstag), ueber sechs Millionen Einheiten und war die erfolgreichste Produkteinfuehrung der Videospielgeschichte bis zu diesem Zeitpunkt.",
      "Der Mega Drive war auch die Heimat von Segas herausragenden Arcade-Portierungen. Streets of Rage, Golden Axe, Altered Beast und Virtua Fighter 2 — Sega brachte das Arcade-Erlebnis ins Wohnzimmer wie kein anderer. Die Konsole hatte ausserdem eine starke Sport-Spiele-Bibliothek dank EA und eine lebendige RPG-Szene mit den Shining-Force- und Phantasy-Star-Serien."
    ],
    facts: {
      unitsSold: "30,75 Millionen",
      cpu: "Motorola 68000 (7,67 MHz)",
      gameLibrary: "915 offizielle Spiele",
      launchPrice: "21.000 Yen / $189,99 (1989)",
    },
    milestones: [
      { title: "Sonic the Hedgehog", year: 1991, description: "Segas Antwort auf Mario — definierte die Marke Sega und verkaufte 15 Millionen Einheiten" },
      { title: "Streets of Rage 2", year: 1992, description: "Einer der besten Beat'em'ups aller Zeiten mit legendaerem Soundtrack von Yuzo Koshiro" },
      { title: "Gunstar Heroes", year: 1993, description: "Treasures Debuet — ein technisches Wunderwerk mit Non-Stop-Action und Co-Op" },
      { title: "Phantasy Star IV", year: 1993, description: "Kraoenung der Serie mit Manga-Cutscenes und einem der besten RPG-Kampfsysteme der Aera" },
      { title: "Sonic the Hedgehog 2", year: 1992, description: "Fuehrte Tails und den Spin Dash ein — der 'Sonic 2sday'-Launch war ein Marketing-Meilenstein" },
    ],
  },
  {
    platformId: "segacd",
    manufacturer: "Sega",
    releaseYear: 1991,
    alternateNames: ["Sega CD (Nordamerika)", "Mega-CD (Japan/Europa)"],
    history: [
      "Das Sega CD war Segas Versuch, den Mega Drive mit CD-ROM-Technologie aufzuruesten. Die zusaetzliche Hardware bot mehr Speicherplatz, Skalierungs- und Rotationseffekte und die Moeglichkeit, CD-Audio und Full-Motion-Video (FMV) abzuspielen. Sega versprach eine Revolution — doch die Realitaet war ernuechternd.",
      "Statt die zusaetzliche Leistung fuer besseres Gameplay zu nutzen, ueberfluteten Entwickler den Markt mit billigen FMV-Spielen. Night Trap, Ground Zero Texas und aehnliche Titel bestanden aus schlecht gefilmten Videos mit minimaler Interaktion. Diese FMV-Schwemme schadete dem Image des Sega CD erheblich. Night Trap loeste zudem eine politische Kontroverse aus, die direkt zur Gruendung des ESRB-Altersfreigabesystems fuehrte.",
      "Trotzdem gab es Perlen: Sonic CD gilt als eines der besten Sonic-Spiele ueberhaupt, mit dem innovativen Zeitreise-Konzept. Lunar: The Silver Star und Lunar: Eternal Blue von Game Arts waren herausragende RPGs. Snatcher von Hideo Kojima bot eine fesselnde Cyberpunk-Geschichte. Diese Titel konnten den kommerziellen Misserfolg des Sega CD jedoch nicht verhindern."
    ],
    facts: {
      unitsSold: "2,24 Millionen",
      cpu: "Motorola 68000 (12,5 MHz, zusaetzlich zum Mega Drive)",
      gameLibrary: "210 offizielle Spiele",
      launchPrice: "49.800 Yen / $299 (1992)",
    },
    milestones: [
      { title: "Sonic CD", year: 1993, description: "Innovatives Zeitreise-Konzept mit Past/Future-Zonen und legendaerem Soundtrack" },
      { title: "Lunar: The Silver Star", year: 1992, description: "Eines der besten RPGs der 16-Bit-Aera mit wunderschoenen Anime-Cutscenes" },
      { title: "Snatcher", year: 1994, description: "Hideo Kojimas Cyberpunk-Adventure — ein narratives Meisterwerk" },
      { title: "Night Trap", year: 1992, description: "Beruechtigtes FMV-Spiel, das zum Symbol der Videospiel-Zensur-Debatte wurde" },
    ],
  },
  {
    platformId: "sega32x",
    manufacturer: "Sega",
    releaseYear: 1994,
    alternateNames: ["Sega 32X", "Super 32X (Japan)", "Sega Mars (Codename)"],
    history: [
      "Das Sega 32X war ein Paradebeispiel fuer Segas chaotische Hardwarestrategie Mitte der 90er Jahre. Es war ein Erweiterungsadapter, der auf den Mega Drive aufgesteckt wurde und 32-Bit-Faehigkeiten hinzufuegte. Das Problem: Als es 1994 erschien, war der Sega Saturn bereits angekuendigt — warum sollten Konsumenten in eine Uebergangsloesung investieren?",
      "Die Antwort lautete: Das taten sie nicht. Das 32X verkaufte sich katastrophal schlecht. Nur 40 Spiele erschienen, und die meisten waren enttaeuschende Ports. Sogar Segas eigene Teams wussten nicht, wofuer sie entwickeln sollten — 32X oder Saturn? Diese interne Verwirrung fuehrte zu einer Fragmentierung der Ressourcen, die Sega langfristig schwer schadete.",
      "Das 32X gilt heute als eines der groessten Misserfolge der Videospielgeschichte und als Warnung vor uebereilten Hardware-Zyklen. Es gab einige wenige gelungene Titel wie Knuckles' Chaotix und die Portierung von Doom, aber das Gesamtpaket ueberzeugte niemanden. Die 'Tower of Power' — Mega Drive mit Sega CD und 32X gestapelt — wurde zum Symbol fuer Segas Fehlentscheidungen."
    ],
    facts: {
      unitsSold: "665.000",
      cpu: "2x Hitachi SH2 (23 MHz)",
      gameLibrary: "40 offizielle Spiele",
      launchPrice: "16.800 Yen / $159,99 (1994)",
    },
    milestones: [
      { title: "Knuckles' Chaotix", year: 1995, description: "Einziges Sonic-Universum-Spiel fuer 32X mit innovativer Gummiband-Koop-Mechanik" },
      { title: "Doom (32X)", year: 1994, description: "Beeindruckende Portierung von id Softwares Klassiker — das Highlight der Plattform" },
      { title: "Star Wars Arcade", year: 1994, description: "3D-Weltraumkaempfe, die die technischen Moeglichkeiten des 32X demonstrierten" },
    ],
  },
  {
    platformId: "saturn",
    manufacturer: "Sega",
    releaseYear: 1994,
    alternateNames: ["Sega Saturn"],
    history: [
      "Der Sega Saturn war technisch faszinierend — mit seinen acht Prozessoren und der Dual-CPU-Architektur war er eine der komplexesten Konsolen seiner Zeit. In Japan war er ein Riesenerfolg, vor allem dank Virtua Fighter und der starken Arcade-Portierungen. Das Problem lag in Nordamerika: Die ueberraschende Vorveroeffendlichung zum Launch ('Surprise Launch') veraergerte Haendler und Entwickler gleichermassen.",
      "Segas Entscheidung, den Saturn vier Monate vor dem geplanten Termin auf den Markt zu werfen, war ein strategisches Desaster. Haendler, die nicht informiert worden waren, listeten Sega-Produkte aus Protest aus. Entwickler hatten keine Zeit, Launch-Titel fertigzustellen. Und nur Stunden spaeter kuendigte Sony die PlayStation fuer $100 weniger an — ein vernichtender Schlag.",
      "Trotz des kommerziellen Misserfolgs im Westen besitzt der Saturn eine der besten 2D-Spielebibliotheken aller Zeiten. Japanische Titel wie Radiant Silvergun, Guardian Heroes, Panzer Dragoon Saga und die Street-Fighter-Portierungen sind legendaer. In Japan war der Saturn dank Segas Arcade-Dominanz weitaus erfolgreicher und hielt sich bis 2000."
    ],
    facts: {
      unitsSold: "9,26 Millionen",
      cpu: "2x Hitachi SH2 (28,6 MHz)",
      gameLibrary: "1.094 offizielle Spiele",
      launchPrice: "44.800 Yen / $399 (1995)",
    },
    milestones: [
      { title: "Virtua Fighter 2", year: 1995, description: "Die beste Arcade-Portierung ihrer Zeit — trieb Saturn-Verkaeufe in Japan in die Hoehe" },
      { title: "Panzer Dragoon Saga", year: 1998, description: "Legendaeres RPG mit nur 30.000 Stueck im Westen — heute tausende Euro wert" },
      { title: "Radiant Silvergun", year: 1998, description: "Treasures Meisterwerk gilt als einer der besten Shoot'em'ups aller Zeiten" },
      { title: "Nights into Dreams...", year: 1996, description: "Yuji Nakas traumhaftes Flugabenteuer mit innovativer Analog-Steuerung" },
      { title: "Guardian Heroes", year: 1996, description: "Treasures Beat'em'up-RPG-Hybrid mit verzweigten Pfaden und Mehrspieler-Chaos" },
    ],
  },
  {
    platformId: "dreamcast",
    manufacturer: "Sega",
    releaseYear: 1998,
    alternateNames: ["Sega Dreamcast", "DC", "Katana (Codename)"],
    history: [
      "Der Dreamcast war Segas letzter Versuch im Konsolenmarkt — und technisch seiner Zeit weit voraus. Als erste Konsole mit eingebautem Modem bot er Online-Multiplayer, Webzugang und sogar eine eigene Tastatur. Die VMU (Visual Memory Unit) war ein Controller mit eingebautem Minibildschirm, auf dem Minispiele und Spielinformationen angezeigt wurden — ein Konzept, das erst die Wii U Jahre spaeter wieder aufgriff.",
      "Der Launch am 9.9.1999 war der erfolgreichste Konsolenstart der Geschichte — ueber 225.000 Einheiten allein am ersten Tag in Nordamerika. Shenmue, das teuerste Spiel seiner Zeit mit einem Budget von 70 Millionen Dollar, bot eine offene Spielwelt mit nie dagewesenem Detailreichtum. Jet Set Radio praegte den Cel-Shading-Stil, Crazy Taxi wurde zum Arcade-Hit, und Soul Calibur galt als bestes Kampfspiel seiner Generation.",
      "Doch der Dreamcast konnte den Schaden nicht reparieren, den Segas Fehlentscheidungen der vorherigen Jahre angerichtet hatten. Das Vertrauen der Drittanbieter war zerstoert, und die Ankuendigung der PlayStation 2 bremste den Verkauf. Am 31. Januar 2001 kuendigte Sega den Rueckzug aus dem Hardwaremarkt an. Der Dreamcast wurde nach nur zwei Jahren und vier Monaten eingestellt — eine Tragoedie fuer die Videospielwelt."
    ],
    facts: {
      unitsSold: "9,13 Millionen",
      cpu: "Hitachi SH4 (200 MHz)",
      gameLibrary: "620 offizielle Spiele",
      launchPrice: "29.900 Yen / $199 (1999)",
    },
    milestones: [
      { title: "Shenmue", year: 1999, description: "Pionier der offenen Spielwelt — das teuerste Spiel seiner Zeit mit 70 Mio. Dollar Budget" },
      { title: "Soul Calibur", year: 1999, description: "Galt als perfekte Arcade-Portierung und eines der besten Kampfspiele ueberhaupt" },
      { title: "Jet Set Radio", year: 2000, description: "Praegte den Cel-Shading-Grafikstil und bot einzigartige Graffiti-Gameplay-Mechaniken" },
      { title: "Crazy Taxi", year: 1999, description: "Arcade-Spass pur mit Punk-Rock-Soundtrack — definierte das Chaos-Racer-Genre" },
      { title: "Phantasy Star Online", year: 2000, description: "Erstes Konsolen-Online-RPG — Wegbereiter fuer alle zukuenftigen Konsolen-MMOs" },
    ],
  },
  {
    platformId: "gamegear",
    manufacturer: "Sega",
    releaseYear: 1990,
    alternateNames: ["Sega Game Gear", "GG"],
    history: [
      "Der Game Gear war Segas direkte Antwort auf den Game Boy — und auf dem Papier war er haushoch ueberlegen. Ein farbiges, hintergrundbeleuchtetes Display, technisch basierend auf dem Master System, bot er eine Grafik, die Nintendos monochromen Handheld alt aussehen liess. Doch was auf dem Papier gewann, verlor in der Praxis.",
      "Das groesste Problem des Game Gear war der enorme Stromverbrauch. Sechs AA-Batterien hielten nur drei bis fuenf Stunden — im Vergleich zu ueber 30 Stunden beim Game Boy. Dies machte den Game Gear unterwegs unpraktisch und teuer im Unterhalt. Zudem war das Geraet deutlich groesser und schwerer als der Game Boy.",
      "Die Spielebibliothek bestand zu grossen Teilen aus Master-System-Portierungen, was den Game Gear technisch zu einer tragbaren Master-System-Variante machte. Titel wie Sonic Triple Trouble, Shining Force: Sword of Hajya und Columns waren solide, konnten aber nicht mit dem Pokemon-Phaenomen konkurrieren, das den Game Boy am Leben hielt. Nach rund 11 Millionen verkauften Einheiten stellte Sega die Produktion 1997 ein."
    ],
    facts: {
      unitsSold: "10,62 Millionen",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: "363 offizielle Spiele",
      launchPrice: "19.800 Yen / $149,99 (1991)",
    },
    milestones: [
      { title: "Sonic the Hedgehog (GG)", year: 1991, description: "Launch-Titel, der die technische Ueberlegenheit gegenueber dem Game Boy demonstrierte" },
      { title: "Columns", year: 1990, description: "Segas Antwort auf Tetris — ein elegantes Puzzle-Spiel mit Juwelen" },
      { title: "Shining Force: Sword of Hajya", year: 1993, description: "Vollwertiges Taktik-RPG auf dem Handheld — beeindruckend fuer die damalige Zeit" },
      { title: "TV-Tuner-Adapter", year: 1992, description: "Zubehoer, das den Game Gear in einen tragbaren Fernseher verwandelte" },
    ],
  },
  {
    platformId: "model2",
    manufacturer: "Sega",
    releaseYear: 1993,
    alternateNames: ["Sega Model 2", "Model 2A", "Model 2B", "Model 2C"],
    history: [
      "Das Sega Model 2 war ein Arcade-Systemboard, das die Spielhallen der 90er Jahre dominierte. Entwickelt in Zusammenarbeit mit Martin Marietta (heute Lockheed Martin), nutzte es Technologie aus der Militaersimulation fuer Videospiele. Das Ergebnis war die beeindruckendste 3D-Grafik, die man 1993 in einer Spielhalle sehen konnte.",
      "Virtua Fighter, Daytona USA, Virtua Cop und The House of the Dead — die Titel des Model 2 praegte eine Aera. Daytona USA mit seinem unvergesslichen Soundtrack ('Daytonaaaa!') war eines der profitabelsten Arcade-Spiele aller Zeiten. Virtua Fighter 2 setzte neue Massstaebe fuer Kampfspiele mit seiner fluessigen Animation und tiefen Spielmechanik.",
      "Das Model 2 durchlief drei Revisionen (A, B und C), wobei jede die Texturfaehigkeiten und Polygonleistung verbesserte. Die Hardware war so leistungsfaehig, dass eine originalgetreue Heimkonsolenportierung erst mit dem Saturn-Nachfolger Dreamcast moeglich wurde. Viele Model-2-Titel gelten bis heute als Genre-Meilensteine."
    ],
    facts: {
      unitsSold: "Arcade-System (kein Konsolen-Verkauf)",
      cpu: "Intel i960-KB (25 MHz) + Fujitsu TGP",
      gameLibrary: "28 offizielle Titel",
      launchPrice: "Arcade-System (ca. $10.000-$20.000 pro Einheit)",
    },
    milestones: [
      { title: "Daytona USA", year: 1993, description: "Eines der profitabelsten Arcade-Spiele aller Zeiten mit legendaerem Soundtrack" },
      { title: "Virtua Fighter 2", year: 1994, description: "Setzte den Standard fuer 3D-Kampfspiele mit 60 fps und 700.000 Polygonen pro Sekunde" },
      { title: "Virtua Cop", year: 1994, description: "Definierte den Lightgun-Shooter mit Zielsystem und zerstoerbarer Umgebung" },
      { title: "The House of the Dead", year: 1996, description: "Begruendete eine der beliebtesten Arcade-Horror-Serien" },
    ],
  },

  // ── Sony ──
  {
    platformId: "psx",
    manufacturer: "Sony",
    releaseYear: 1994,
    alternateNames: ["PlayStation", "PS1", "PSX", "PSone"],
    history: [
      "Die PlayStation entstand aus einer gescheiterten Partnerschaft. Nintendo hatte Sony beauftragt, ein CD-ROM-Laufwerk fuer das Super Nintendo zu entwickeln. Als Nintendo den Deal in letzter Minute platzen liess und stattdessen mit Philips zusammenarbeitete, war Ken Kutaragi — der Vater der PlayStation — zutiefst gedemuetigt. Was folgte, war einer der groessten Racheakte der Wirtschaftsgeschichte.",
      "Sony, ein Elektronikgigant ohne Erfahrung im Spielebereich, investierte massiv in Partnerschaften mit Drittanbietern. Waehrend Nintendo weiterhin restriktive Lizenzbedingungen verlangte, bot Sony guenstigere Konditionen und CD-ROMs statt teurer Module. Dies lockte Entwickler wie Square (Final Fantasy VII), Konami (Metal Gear Solid) und Naughty Dog (Crash Bandicoot) an.",
      "Die PlayStation wurde zum kulturellen Phaenomen der 90er Jahre. Sie machte Videospiele fuer Erwachsene gesellschaftsfaehig — das Design war bewusst kuhl und nicht kindlich. Techno-Musik, Nachtclubs und Underground-Kultur praegten das Marketing. Mit ueber 102 Millionen verkauften Einheiten veraenderte die PlayStation die Videospiellandschaft fuer immer und machte Sony zum Marktfuehrer."
    ],
    facts: {
      unitsSold: "102,49 Millionen",
      cpu: "R3000A (33,87 MHz)",
      gameLibrary: "2.500+ Spiele",
      launchPrice: "39.800 Yen / $299 (1995)",
    },
    milestones: [
      { title: "Final Fantasy VII", year: 1997, description: "Brachte JRPGs in den Mainstream und war der Grund, warum Millionen eine PlayStation kauften" },
      { title: "Metal Gear Solid", year: 1998, description: "Definierte das Stealth-Genre und hob Videospiel-Erzaehlung auf Filmniveau" },
      { title: "Resident Evil", year: 1996, description: "Begruendete das Survival-Horror-Genre und praegte eine Generation von Spielern" },
      { title: "Crash Bandicoot", year: 1996, description: "Sonys inoffizielles Maskottchen — bewies, dass PlayStation auch Spass fuer Junge bieten konnte" },
      { title: "Gran Turismo", year: 1997, description: "Revolutionierte das Rennspiel-Genre mit akribischer Autosimulation und ueber 10 Mio. verkauften Einheiten" },
    ],
  },
  {
    platformId: "ps2",
    manufacturer: "Sony",
    releaseYear: 2000,
    alternateNames: ["PlayStation 2", "PS2"],
    history: [
      "Die PlayStation 2 ist die meistverkaufte Spielkonsole aller Zeiten — ueber 155 Millionen Einheiten in 13 Jahren Produktionszeit. Ihr Erfolg basierte auf einer klugen Strategie: Sie war bei Launch der guenstigste DVD-Player auf dem Markt, was viele Kaeufer anzog, die primaer Filme schauen wollten. Einmal im Wohnzimmer, wurden aus DVD-Zuschauern Spieler.",
      "Die Rueckwaertskompatibilitaet mit der originalen PlayStation sicherte vom ersten Tag an eine riesige Spielebibliothek. Doch die PS2 baute schnell eine eigene, legendaere Sammlung auf. Grand Theft Auto III definierte die Open-World-Formel. God of War setzte neue Massstaebe fuer Action-Spiele. Shadow of the Colossus bewies, dass Spiele Kunst sein koennen. Die Vielfalt war atemberaubend.",
      "Selbst als Xbox 360 und PlayStation 3 bereits auf dem Markt waren, verkaufte sich die PS2 weiter. Das letzte offizielle Spiel, Pro Evolution Soccer 2014, erschien im November 2013 — dreizehn Jahre nach dem Launch. Diese beispiellose Langlebigkeit zeugt von der staerke einer Plattform, die ein ganzes Medium praegte."
    ],
    facts: {
      unitsSold: "155 Millionen",
      cpu: "Emotion Engine (294,912 MHz)",
      gameLibrary: "4.489 offizielle Spiele",
      launchPrice: "39.800 Yen / $299 (2000)",
    },
    milestones: [
      { title: "Grand Theft Auto: San Andreas", year: 2004, description: "Riesige offene Spielwelt mit beispielloser Freiheit — kulturelles Phaenomen der 2000er" },
      { title: "Shadow of the Colossus", year: 2005, description: "Nur 16 Bosse, keine Gegner dazwischen — ein kuenstlerisches Meisterwerk, das Spiele als Kunstform legitimierte" },
      { title: "Metal Gear Solid 3: Snake Eater", year: 2004, description: "Perfektionierte das Stealth-Genre mit Tarnung, Survival-Elementen und einer herzzerreissenden Story" },
      { title: "Final Fantasy X", year: 2001, description: "Erstes vollvertontes Final Fantasy mit emotionaler Geschichte und ueber 8 Mio. verkauften Einheiten" },
      { title: "God of War", year: 2005, description: "Brutales Actionspiel inspiriert von griechischer Mythologie — begruendete eine Mega-Franchise" },
    ],
  },
  {
    platformId: "ps3",
    manufacturer: "Sony",
    releaseYear: 2006,
    alternateNames: ["PlayStation 3", "PS3"],
    history: [
      "Die PlayStation 3 hatte den wohl schwierigsten Start einer Sony-Konsole. Der Preis von $599 beim Launch — bedingt durch den teuren Cell-Prozessor und das Blu-ray-Laufwerk — schockte die Branche. Ken Kutaragis beruehmte Aussage, Konsumenten sollten 'mehr arbeiten', um sich die PS3 leisten zu koennen, wurde zum PR-Desaster. Die Xbox 360 hatte ein Jahr Vorsprung und war deutlich guenstiger.",
      "Doch Sony kaempfte sich zurueck. Der Cell-Prozessor, obwohl schwer zu programmieren, ermoeglichte technische Meisterleistungen wenn Entwickler seine Eigenheiten verstanden. Naughty Dogs The Last of Us und Uncharted-Serie zeigten, was die Hardware konnte. Das PlayStation Network wurde kostenlos angeboten — ein Vorteil gegenueber Microsofts kostenpflichtigem Xbox Live.",
      "Langfristig zahlte sich Sonys Blu-ray-Strategie aus. Die PS3 war erneut einer der guenstigsten Blu-ray-Player und half dem Format, den Formatkrieg gegen HD-DVD zu gewinnen. Gegen Ende ihres Lebenszyklus hatte die PS3 die Xbox 360 bei den weltweiten Verkaufszahlen eingeholt und bot eine der staerksten Exklusiv-Bibliotheken der Konsolengeschichte."
    ],
    facts: {
      unitsSold: "87,4 Millionen",
      cpu: "Cell Broadband Engine (3,2 GHz)",
      gameLibrary: "2.565 offizielle Spiele",
      launchPrice: "59.980 Yen / $499-$599 (2006)",
    },
    milestones: [
      { title: "The Last of Us", year: 2013, description: "Emotionales Meisterwerk von Naughty Dog, das die Grenzen von Videospiel-Erzaehlung verschob" },
      { title: "Uncharted 2: Among Thieves", year: 2009, description: "Setzte neue Standards fuer cineastisches Action-Adventure-Design" },
      { title: "Demon's Souls", year: 2009, description: "Begruendete das 'Soulslike'-Genre und inspirierte Dark Souls, Elden Ring und unzaehlige Nachahmer" },
      { title: "Metal Gear Solid 4", year: 2008, description: "Episches Finale der Solid-Snake-Saga mit filmreifen Cutscenes" },
      { title: "Journey", year: 2012, description: "Wortloses Multiplayer-Erlebnis, das als erstes Spiel eine Grammy-Nominierung erhielt" },
    ],
  },
  {
    platformId: "psp",
    manufacturer: "Sony",
    releaseYear: 2004,
    alternateNames: ["PlayStation Portable", "PSP"],
    history: [
      "Die PlayStation Portable war Sonys erster Versuch im Handheld-Markt — und ein direkter Angriff auf Nintendos Dominanz. Mit einem grossen, wunderschoenen Breitbild-Display, beeindruckender 3D-Grafik (nahe PS2-Niveau) und dem proprietaeren UMD-Disc-Format bot die PSP eine Handheld-Erfahrung, die alles Bisherige in den Schatten stellte.",
      "Sonys Vision war ein 'tragbares Mediacenter' — neben Spielen konnte die PSP Filme auf UMD abspielen, Musik hoeren und im Internet surfen. Diese Multimediafaehigkeiten sprachen ein aelteres Publikum an. In Japan war die PSP ein Riesenerfolg, vor allem dank Monster Hunter. Die Monster-Hunter-Titel verkauften Millionen und machten die PSP in japanischen Zuegen allgegenwaertig.",
      "Trotz starker Verkaufszahlen konnte die PSP den Nintendo DS nie ueberholen. Die UMD-Discs waren langsam, fragil und vergraulten spaeter die Nutzer — Sony wechselte mit dem Nachfolger PS Vita auf Speicherkarten. Die aktive Homebrew- und Modding-Szene haelt die PSP bis heute am Leben, und die PSP-Emulation auf modernen Geraeten ist hervorragend."
    ],
    facts: {
      unitsSold: "80 Millionen",
      cpu: "MIPS R4000 (333 MHz)",
      gameLibrary: "1.367 offizielle Spiele",
      launchPrice: "19.800 Yen / $249 (2005)",
    },
    milestones: [
      { title: "Monster Hunter Freedom Unite", year: 2008, description: "Verkaufte ueber 5 Millionen Einheiten in Japan und definierte kooperatives Handheld-Gaming" },
      { title: "God of War: Chains of Olympus", year: 2008, description: "Bewies, dass Konsolenerfahrungen auf dem Handheld moeglich sind" },
      { title: "Crisis Core: Final Fantasy VII", year: 2007, description: "Prequels zu FF VII mit emotionaler Geschichte um Zack Fair" },
      { title: "Grand Theft Auto: Liberty City Stories", year: 2005, description: "Vollwertiges GTA in der Hosentasche — ein technisches Wunderwerk fuer die PSP" },
      { title: "Persona 3 Portable", year: 2009, description: "Definitive Version des beliebten RPGs mit weiblicher Protagonisten-Option" },
    ],
  },
  {
    platformId: "psvita",
    manufacturer: "Sony",
    releaseYear: 2011,
    alternateNames: ["PlayStation Vita", "PS Vita", "NGP (Next Generation Portable)"],
    history: [
      "Die PlayStation Vita war technisch beeindruckend — ein OLED-Touchscreen, ein rueckseitiges Touchpad, zwei Analogsticks und Grafik nahe PS3-Niveau. Sony versprach 'Konsolenqualitaet fuer unterwegs' und lieferte Hardware, die dieses Versprechen haette einloesen koennen. Doch der Markt hatte sich veraendert.",
      "Smartphones hatten den Casual-Gaming-Markt uebernommen, und viele Spieler sahen keinen Grund, ein dediziertes Handheld-Geraet zu kaufen. Sonys eigene Studios stellten die Unterstuetzung frueh ein, was zu einem Mangel an Blockbuster-Titeln fuehrte. Die proprietaeren und ueberteuerten Speicherkarten veraergerten die Kunden zusaetzlich.",
      "Trotz des kommerziellen Misserfolgs fand die Vita eine treue Nische bei Indie- und japanischen Spielen. Persona 4 Golden, Gravity Rush und Danganronpa machten sie zur unverzichtbaren Plattform fuer Liebhaber japanischer Spiele. Die Vita-Community ist bis heute leidenschaftlich, und die Konsole gilt als einer der groessten 'Was waere wenn'-Momente der Videospielgeschichte."
    ],
    facts: {
      unitsSold: "15,9 Millionen",
      cpu: "ARM Cortex-A9 MPCore (Quad-Core, 2 GHz)",
      gameLibrary: "1.500+ Spiele",
      launchPrice: "24.980 Yen / $249 (2012)",
    },
    milestones: [
      { title: "Persona 4 Golden", year: 2012, description: "Definitive Version des RPG-Klassikers — galt als Hauptgrund, eine Vita zu kaufen" },
      { title: "Gravity Rush", year: 2012, description: "Einzigartiges Schwerkraft-Gameplay, das die Touchscreen- und Bewegungssteuerung der Vita nutzte" },
      { title: "Uncharted: Golden Abyss", year: 2011, description: "Bewies, dass AAA-Action-Adventures auf dem Handheld moeglich sind" },
      { title: "Danganronpa: Trigger Happy Havoc", year: 2013, description: "Visual Novel mit Mord-Mysterium, die eine globale Fangemeinde aufbaute" },
    ],
  },

  // ── Microsoft ──
  {
    platformId: "xbox",
    manufacturer: "Microsoft",
    releaseYear: 2001,
    alternateNames: ["Xbox", "Xbox Original", "OG Xbox"],
    history: [
      "Als Microsoft 2001 die Xbox ankuendigte, lachte die Branche. Ein Softwareunternehmen im Konsolenmarkt? Bill Gates persoenlich stellte die Konsole auf der Game Developers Conference vor und betonte, dass die Xbox die leistungsfaehigste Konsole aller Zeiten sein wuerde — mit einem Intel-Pentium-III-Prozessor und einer NVIDIA-Grafikkarte bot sie PC-aehnliche Hardware in einem Konsolengehaeuse.",
      "Der Xbox fehlte es anfangs an japanischer Unterstuetzung, aber Microsoft machte dies mit westlichen Exklusivtiteln wett. Halo: Combat Evolved veraenderte die Spielelandschaft fuer immer — es bewies, dass Ego-Shooter auf Konsolen nicht nur funktionieren, sondern die PC-Versionen uebertreffen koennen. Der Master Chief wurde ueber Nacht zur Ikone.",
      "Die groesste Innovation der Xbox war Xbox Live — der erste wirklich funktionierende Online-Multiplayer-Dienst fuer Konsolen. Halo 2 wurde zum ersten grossen Online-Konsolen-Shooter, und die Infrastruktur, die Microsoft hier aufbaute, praegte das Online-Gaming fuer Generationen. Finanziell verlor Microsoft Milliarden mit der Xbox, aber die strategische Investition in den Gaming-Markt zahlte sich langfristig aus."
    ],
    facts: {
      unitsSold: "24 Millionen",
      cpu: "Intel Pentium III (733 MHz)",
      gameLibrary: "1.000+ Spiele",
      launchPrice: "$299 (2001)",
    },
    milestones: [
      { title: "Halo: Combat Evolved", year: 2001, description: "Definierte den Konsolen-Ego-Shooter und machte die Xbox ueber Nacht relevant" },
      { title: "Halo 2", year: 2004, description: "Pionieer des Konsolen-Online-Multiplayers ueber Xbox Live" },
      { title: "Star Wars: Knights of the Old Republic", year: 2003, description: "BioWares Meisterwerk — eines der besten RPGs aller Zeiten" },
      { title: "Fable", year: 2004, description: "Peter Molyneuxs ambitioniertes RPG mit Gut/Boese-Moral-System" },
      { title: "Xbox Live Launch", year: 2002, description: "Erster funktionierender Online-Dienst fuer Konsolen — veraenderte die Branche nachhaltig" },
    ],
  },
  {
    platformId: "xbox360",
    manufacturer: "Microsoft",
    releaseYear: 2005,
    alternateNames: ["Xbox 360", "Xenon (Codename)"],
    history: [
      "Die Xbox 360 erschien ein Jahr vor der PlayStation 3 und nutzte diesen Vorsprung geschickt. Microsoft hatte aus den Fehlern der ersten Xbox gelernt: Das Design war schlanker, der Controller ueberarbeitet und Xbox Live zu einem vollwertigen sozialen Netzwerk ausgebaut. Gamerscore, Achievements und der Xbox Live Marketplace setzten Standards, die die gesamte Branche uebernahm.",
      "Die 360 hatte jedoch ein dunkles Geheimnis: den 'Red Ring of Death' (RROD). Ein Designfehler fuehrte bei fruehen Modellen zu massiven Hardwareausfaellen — die Ausfallrate lag bei geschaetzt 23-54%. Microsoft musste ueber eine Milliarde Dollar fuer Garantieverlaengerungen zurueckstellen. Trotz dieses Debakels blieb die Fangemeinde treu — ein Zeugnis der Staerke der Spielebibliothek.",
      "Die Xbox 360 praegte eine ganze Konsolengeneration. Gears of War definierte den Deckungsshooter, Mass Effect schuf eine epische Science-Fiction-Trilogie, und Xbox Live Arcade machte Indie-Spiele auf Konsolen populaer. Titel wie Braid, Castle Crashers und Limbo fanden hier ihr erstes grosses Publikum und ebneten den Weg fuer die Indie-Revolution."
    ],
    facts: {
      unitsSold: "84 Millionen",
      cpu: "IBM Xenon (3,2 GHz, Triple-Core)",
      gameLibrary: "2.154 offizielle Spiele",
      launchPrice: "$299-$399 (2005)",
    },
    milestones: [
      { title: "Gears of War", year: 2006, description: "Definierte den Deckungsshooter und setzte neue Grafik-Massstaebe mit der Unreal Engine 3" },
      { title: "Mass Effect 2", year: 2010, description: "Perfekte Verbindung von Action-Gameplay und verzweigter Erzaehlung" },
      { title: "Halo 3", year: 2007, description: "Erwirtschaftete 170 Millionen Dollar am ersten Tag — groesster Medienstart der Geschichte zu dieser Zeit" },
      { title: "The Elder Scrolls V: Skyrim", year: 2011, description: "Obwohl multiplattform, praegte Skyrim die Xbox-360-Aera wie kaum ein anderes Spiel" },
      { title: "Xbox Live Arcade", year: 2005, description: "Plattform fuer Indie-Spiele, die Braid, Limbo und Castle Crashers populaer machte" },
    ],
  },

  // ── Atari ──
  {
    platformId: "atari2600",
    manufacturer: "Atari",
    releaseYear: 1977,
    alternateNames: ["Atari VCS", "Atari 2600", "Heavy Sixer"],
    history: [
      "Der Atari 2600, urspruenglich als Video Computer System (VCS) verkauft, war die Konsole, die Videospiele in die Wohnzimmer der Welt brachte. Vor dem VCS waren Konsolen auf fest einprogrammierte Spiele beschraenkt — der 2600 fuehrte austauschbare Spielmodule ein und schuf damit den modernen Konsolenmarkt. Atari-Mitgruender Nolan Bushnell verkaufte das Unternehmen an Warner Communications, um die Entwicklung zu finanzieren.",
      "Der Erfolg kam nicht sofort. Erst 1980, mit der Portierung von Space Invaders, explodierte der Markt. Space Invaders wurde zum ersten 'Systemseller' — Menschen kauften den 2600 nur fuer dieses eine Spiel. Es folgten Pac-Man, Pitfall!, River Raid und Adventure, das die erste Easter-Egg-Tradition in Videospielen begruendete (Entwickler Warren Robinett versteckte seinen Namen im Spiel).",
      "Doch Ataris mangelnde Qualitaetskontrolle fuehrte zum beruehmten Videospiel-Crash von 1983. Das E.T.-Spiel, in nur fuenf Wochen entwickelt, wurde zum Symbol des Crashs — Millionen unverkaufter Module wurden angeblich auf einer Muellhalde in New Mexico vergraben (2014 tatsaechlich ausgegraben und bestaetigt). Trotzdem bleibt der 2600 als Wegbereiter der gesamten Industrie unvergessen."
    ],
    facts: {
      unitsSold: "30 Millionen",
      cpu: "MOS 6507 (1,19 MHz)",
      gameLibrary: "565 offizielle Spiele",
      launchPrice: "$199 (1977)",
    },
    milestones: [
      { title: "Space Invaders", year: 1980, description: "Erster 'Systemseller' — vervierfachte die Verkaufszahlen des 2600" },
      { title: "Pitfall!", year: 1982, description: "Von David Crane bei Activision — gilt als Vorlaeufer des Jump'n'Run-Genres" },
      { title: "Adventure", year: 1980, description: "Erstes Action-Adventure und Ursprung der Easter-Egg-Tradition in Videospielen" },
      { title: "E.T. the Extra-Terrestrial", year: 1982, description: "In fuenf Wochen entwickelt — wurde zum Symbol des Videospiel-Crashs von 1983" },
      { title: "Activision-Gruendung", year: 1979, description: "Frustrierte Atari-Entwickler gruendeten den ersten unabhaengigen Spielepublisher der Geschichte" },
    ],
  },
  {
    platformId: "atari5200",
    manufacturer: "Atari",
    releaseYear: 1982,
    alternateNames: ["Atari 5200 SuperSystem"],
    history: [
      "Der Atari 5200 war als Nachfolger des aeusserst erfolgreichen 2600 konzipiert und basierte intern auf dem Atari-400-Computer. Er bot bessere Grafik und Sound, wurde aber von mehreren Designfehlern geplagt. Der groesste Kritikpunkt war der analoge Controller — er war fragil, zentrierte sich nicht selbst und ging haeufig kaputt.",
      "Erschwerend kam hinzu, dass der 5200 nicht rueckwaertskompatibel mit dem riesigen 2600-Katalog war. Atari brachte spaeter einen Adapter heraus, doch der Schaden war bereits angerichtet. Hinzu kam der Videospiel-Crash von 1983, der den gesamten Markt zusammenbrechen liess. In diesem toxischen Umfeld hatte der 5200 keine Chance.",
      "Trotz dieser Probleme bot der 5200 einige technisch beeindruckende Arcade-Portierungen. Die Version von Moon Patrol, Galaxian und Centipede waren den 2600-Versionen deutlich ueberlegen. Der 5200 verkaufte nur rund eine Million Einheiten und wurde 1984 still eingestellt — ueberrollt vom eigenen Nachfolger, dem Atari 7800."
    ],
    facts: {
      unitsSold: "ca. 1 Million",
      cpu: "MOS 6502C (1,79 MHz)",
      gameLibrary: "69 offizielle Spiele",
      launchPrice: "$269 (1982)",
    },
    milestones: [
      { title: "Super Breakout", year: 1982, description: "Einer der besten Launch-Titel und technisch beeindruckende Portierung" },
      { title: "Centipede", year: 1982, description: "Akkurate Arcade-Portierung, die den analogen Controller sinnvoll nutzte" },
      { title: "Moon Patrol", year: 1983, description: "Exzellente Portierung des Arcade-Klassikers mit Parallax-Scrolling" },
    ],
  },
  {
    platformId: "atari7800",
    manufacturer: "Atari",
    releaseYear: 1986,
    alternateNames: ["Atari 7800 ProSystem"],
    history: [
      "Der Atari 7800 haette Ataris Rettung sein koennen — die Konsole war bereits 1984 fertig und technisch dem NES ebenbuertig. Doch durch den Verkauf von Atari an Jack Tramiel (den ehemaligen Commodore-Chef) wurde der Launch um zwei Jahre verzoegert. Als der 7800 1986 endlich erschien, hatte Nintendo den nordamerikanischen Markt bereits fest im Griff.",
      "Die groesste Staerke des 7800 war seine vollstaendige Rueckwaertskompatibilitaet mit dem Atari 2600 — hunderte Spiele waren sofort verfuegbar. Die Hardware bot hervorragende 2D-Grafik mit vielen Sprites auf dem Bildschirm, was besonders fuer Arcade-Portierungen ideal war. Der Sound hingegen war kaum besser als beim 2600, es sei denn, Spiele nutzten den POKEY-Chip.",
      "Atari versaeuerte es, Drittanbieter zu gewinnen — die meisten Entwickler hatten sich laengst Nintendo verschrieben. Die Spielebibliothek bestand groesstenteils aus Arcade-Portierungen und Eigenentwicklungen. Trotzdem ist der 7800 ein beliebtes Sammlerstueck, und seine Arcade-Ports von Titeln wie Food Fight und Galaga gelten als ausgezeichnet."
    ],
    facts: {
      unitsSold: "ca. 3,77 Millionen",
      cpu: "Sally 6502C (1,79 MHz)",
      gameLibrary: "59 offizielle Spiele",
      launchPrice: "$79,95 (1986)",
    },
    milestones: [
      { title: "Food Fight", year: 1987, description: "Exzellente Arcade-Portierung, die die Sprite-Faehigkeiten der Hardware zeigte" },
      { title: "Galaga", year: 1987, description: "Hervorragende Umsetzung des Arcade-Klassikers" },
      { title: "Atari 2600-Kompatibilitaet", year: 1986, description: "Vollstaendige Abwaertskompatibilitaet mit der riesigen 2600-Bibliothek" },
    ],
  },
  {
    platformId: "atari800",
    manufacturer: "Atari",
    releaseYear: 1979,
    alternateNames: ["Atari 800", "Atari XL", "Atari XE", "Atari 8-Bit-Familie"],
    history: [
      "Die Atari-8-Bit-Computer waren ihrer Zeit in vielerlei Hinsicht voraus. Der Atari 800 erschien 1979 mit Custom-Chips fuer Grafik (ANTIC, GTIA) und Sound (POKEY), die den meisten Konkurrenten ueberlegen waren. Die Hardware ermoeglichte feines Scrolling, viele Sprites und vierkanaligen Sound — Faehigkeiten, die der Commodore 64 erst drei Jahre spaeter in aehnlicher Form bot.",
      "Die Atari-8-Bit-Familie durchlief mehrere Iterationen: vom originalen 400/800 ueber die kostenreduzierten XL-Modelle (600XL, 800XL, 1200XL) bis zur XE-Serie (65XE, 130XE). Der 130XE mit 128 KB RAM war besonders leistungsfaehig. Die Plattform hatte eine starke Spielebibliothek mit Titeln wie Star Raiders, M.U.L.E., Rescue on Fractalus! und Alternate Reality.",
      "Obwohl technisch dem Commodore 64 ebenbuertig oder ueberlegen, verlor Atari den Heimcomputerkrieg. Jack Tramiels aggressive Preispolitik nach der Uebernahme fuehrte zwar zu guenstigen Preisen, aber auch zu reduziertem Marketing und fehlender Softwareunterstuetzung. Die Atari-8-Bit-Computer haben bis heute eine aktive Retro-Community."
    ],
    facts: {
      unitsSold: "ca. 4 Millionen (alle Modelle)",
      cpu: "MOS 6502B (1,79 MHz)",
      gameLibrary: "Tausende Spiele und Programme",
      launchPrice: "$999 (Atari 800, 1979)",
    },
    milestones: [
      { title: "Star Raiders", year: 1979, description: "Revolutionaerer Weltraumsimulator — oft als 'Killerspiel' fuer den Atari 400/800 bezeichnet" },
      { title: "M.U.L.E.", year: 1983, description: "Legendaeres Mehrspieler-Wirtschaftsspiel von Dani Bunten Berry" },
      { title: "Rescue on Fractalus!", year: 1984, description: "Von Lucasfilm Games — nutzte fraktale Landschaften fuer damals revolutionaere 3D-Grafik" },
    ],
  },
  {
    platformId: "lynx",
    manufacturer: "Atari",
    releaseYear: 1989,
    alternateNames: ["Atari Lynx", "Handy (Codename)"],
    history: [
      "Der Atari Lynx war der weltweit erste Handheld mit Farbdisplay und bot technische Faehigkeiten, die den Game Boy weit uebertrafen. Entwickelt von Epyx (den Machern von California Games) und von Atari uebernommen, konnte er Hardware-Skalierung und -Rotation — Effekte, die sonst nur im Arcade-Bereich zu finden waren. Zudem war er der erste Handheld, der Multiplayer fuer bis zu acht Spieler ueber Kabelverbindung unterstuetzte.",
      "Doch der Lynx teilte die gleichen Probleme wie spaeter der Sega Game Gear: Er war zu gross, zu schwer und frass Batterien. Sechs AA-Batterien hielten nur vier bis fuenf Stunden. Zudem war der Preis mit $179,95 deutlich hoeher als die $89,99 des Game Boy. Die mangelnde Drittanbieter-Unterstuetzung und Ataris schwaches Marketing taten ihr Uebriges.",
      "Nur etwa 75 Spiele erschienen fuer den Lynx, und die Konsole verkaufte sich weniger als eine Million Mal. Trotzdem geniesst der Lynx in Retro-Gaming-Kreisen einen Kultstatus. Spiele wie California Games, Blue Lightning und Chip's Challenge zeigten das Potenzial der Hardware, das nie voll ausgeschoepft wurde."
    ],
    facts: {
      unitsSold: "ca. 500.000-700.000",
      cpu: "MOS 65SC02 (4 MHz) + Custom Suzy (16 MHz)",
      gameLibrary: "75 offizielle Spiele",
      launchPrice: "$179,95 (1989)",
    },
    milestones: [
      { title: "California Games", year: 1989, description: "Launch-Titel, der die Farbgrafik und Skalierungsfaehigkeiten eindrucksvoll demonstrierte" },
      { title: "Blue Lightning", year: 1989, description: "Pseudo-3D-Flugspiel, das an After Burner erinnerte — technisch beeindruckend" },
      { title: "Chip's Challenge", year: 1989, description: "Puzzle-Klassiker, der spaeter auf PC portiert und dort zum Kult wurde" },
    ],
  },
  {
    platformId: "jaguar",
    manufacturer: "Atari",
    releaseYear: 1993,
    alternateNames: ["Atari Jaguar"],
    history: [
      "Der Atari Jaguar war Ataris letzter Versuch, im Konsolenmarkt Fuss zu fassen. Mit der Behauptung, die erste '64-Bit-Konsole' zu sein, versuchte Atari, sich technisch vor der Konkurrenz zu positionieren. In Wahrheit war die 64-Bit-Bezeichnung Marketing-Uebertreibung — der Jaguar hatte zwar einen 64-Bit-Objektprozessor, nutzte aber hauptsaechlich 32-Bit-Pfade.",
      "Die Architektur des Jaguar war notorisch schwer zu programmieren. Die Hardware bestand aus fuenf Prozessoren, die koordiniert werden mussten — eine Herausforderung, an der selbst erfahrene Entwickler scheiterten. Die meisten Spiele nutzten aus Bequemlichkeit den langsameren Motorola-68000-Prozessor als Hauptprozessor, anstatt die leistungsfaehigeren Tom- und Jerry-Chips auszureizen.",
      "Das Ergebnis war eine duenne Spielebibliothek mit wenigen Highlights. Tempest 2000 von Jeff Minter gilt als Meisterwerk, und Alien vs. Predator war ein beeindruckender Ego-Shooter. Doch die meisten Titel konnten nicht mit der aufkommenden PlayStation und dem Saturn mithalten. Mit nur 125.000 verkauften Einheiten vor dem Atari Jaguar CD war der Jaguar ein kommerzielles Desaster, das Ataris Konsolengeschaeft endgueltig beendete."
    ],
    facts: {
      unitsSold: "ca. 250.000",
      cpu: "Motorola 68000 (13,3 MHz) + Tom/Jerry-Coprozessoren",
      gameLibrary: "50 offizielle Spiele",
      launchPrice: "$249,99 (1993)",
    },
    milestones: [
      { title: "Tempest 2000", year: 1994, description: "Jeff Minters psychedelisches Meisterwerk — das beste Spiel fuer den Jaguar" },
      { title: "Alien vs. Predator", year: 1994, description: "Atmosphaerischer Ego-Shooter, der das Potenzial der Hardware andeutete" },
      { title: "Doom (Jaguar)", year: 1994, description: "Von John Carmack als beste Konsolen-Portierung von Doom gelobt" },
    ],
  },
  {
    platformId: "jaguarcd",
    manufacturer: "Atari",
    releaseYear: 1995,
    alternateNames: ["Atari Jaguar CD"],
    history: [
      "Das Atari Jaguar CD war ein CD-ROM-Aufsatz fuer den ohnehin schon scheiternden Jaguar. Es erschien 1995, als die PlayStation und der Saturn den Markt bereits dominierten. Atari hoffte, mit dem Zusatzgeraet die Lebensdauer des Jaguar zu verlaengern und Entwicklern mehr Speicherplatz fuer umfangreichere Spiele zu bieten.",
      "Die Realitaet war ernuechternd. Das Jaguar CD hatte massive Zuverlaessigkeitsprobleme — das Laufwerk war anfaellig fuer Fehler, und viele Einheiten fielen frueh aus. Die Spielebibliothek war mit nur 13 offiziellen Titeln winzig. Einige davon, wie Myst und Baldur's Gate: Dark Alliance, waren solide Portierungen, aber es fehlte an exklusiven Titeln, die den Kauf rechtfertigten.",
      "Das Jaguar CD gilt als einer der groessten Flops der Videospielgeschichte. Es markierte das endgueltige Ende von Ataris Konsolengeschaeft. Nach dem Misserfolg fusionierte Atari mit JTS Corporation, und die Marke wechselte in den folgenden Jahren mehrfach den Besitzer. Heute ist das Jaguar CD ein seltenes Sammlerstueck."
    ],
    facts: {
      unitsSold: "ca. 20.000",
      cpu: "Wie Jaguar (CD-Erweiterung)",
      gameLibrary: "13 offizielle Spiele",
      launchPrice: "$149,95 (1995)",
    },
    milestones: [
      { title: "Myst", year: 1995, description: "Portierung des PC-Bestsellers — einer der wenigen Gruende, das Jaguar CD zu kaufen" },
      { title: "Highlander: The Last of the MacLeods", year: 1995, description: "FMV-lastiges Adventure basierend auf der Zeichentrickserie" },
      { title: "Blue Lightning (Jaguar CD)", year: 1995, description: "Ueberarbeitete Version des Lynx-Klassikers mit CD-Qualitaets-Audio" },
    ],
  },
  {
    platformId: "atarist",
    manufacturer: "Atari",
    releaseYear: 1985,
    alternateNames: ["Atari ST", "Atari 520ST", "Atari 1040ST", "Jackintosh"],
    history: [
      "Der Atari ST war Jack Tramiels Rache an Commodore. Nachdem Tramiel Commodore verlassen und Atari uebernommen hatte, brachte er innerhalb eines Jahres einen 16-Bit-Computer heraus, der den Amiga preislich deutlich unterbot. Der Spitzname 'Jackintosh' verwies auf die Aehnlichkeit mit dem Macintosh — der ST bot eine grafische Benutzeroberflaeche (GEM) zu einem Bruchteil des Mac-Preises.",
      "Besonders im Musikbereich wurde der Atari ST legendaer. Er war der erste bezahlbare Computer mit eingebauter MIDI-Schnittstelle, was ihn zum Standard in Tonstudios machte. Fatboy Slim, The Prodigy und unzaehlige andere Musiker nutzten den ST fuer ihre Produktionen. Software wie Cubase (von Steinberg) hatte ihren Ursprung auf dem Atari ST.",
      "Als Spieleplattform war der ST vor allem in Europa erfolgreich, besonders in Deutschland und Frankreich. Die Spielebibliothek teilte er sich groesstenteils mit dem Amiga, wobei der Amiga bei Grafik und Sound meist die Nase vorn hatte. Der ST bot jedoch oft schnellere Prozessorleistung, was CPU-intensive Spiele beguenstigte. Dungeon Master, ein Meilenstein des RPG-Genres, erschien zuerst auf dem Atari ST."
    ],
    facts: {
      unitsSold: "ca. 6 Millionen",
      cpu: "Motorola 68000 (8 MHz)",
      gameLibrary: "2.500+ Spiele",
      launchPrice: "$799,99 (520ST, 1985)",
    },
    milestones: [
      { title: "Dungeon Master", year: 1987, description: "Revolutionaeres Echtzeit-RPG, das zuerst auf dem ST erschien und das Genre praegte" },
      { title: "Cubase (Steinberg)", year: 1989, description: "Musiksoftware, die den ST zum Studio-Standard machte — existiert bis heute" },
      { title: "Enchanted Land", year: 1990, description: "Technisch beeindruckender Plattformer, der die Faehigkeiten des ST demonstrierte" },
    ],
  },

  // ── NEC ──
  {
    platformId: "pcengine",
    manufacturer: "NEC / Hudson Soft",
    releaseYear: 1987,
    alternateNames: ["PC Engine (Japan)", "TurboGrafx-16 (Nordamerika)", "CoreGrafx"],
    history: [
      "Die PC Engine, in Nordamerika als TurboGrafx-16 bekannt, war eine der innovativsten Konsolen der spaten 80er Jahre. Entwickelt von Hudson Soft und vermarktet von NEC, war sie die erste Konsole mit einem optionalen CD-ROM-Laufwerk (CD-ROM²) — Jahre bevor Sony oder Sega diesen Schritt wagten. In Japan war die PC Engine ein enormer Erfolg und verdraengte zeitweise Nintendos Famicom vom zweiten Platz.",
      "Die Hardware war clever konzipiert: Ein 8-Bit-Hauptprozessor wurde mit einem leistungsfaehigen 16-Bit-Grafikprozessor kombiniert, der bis zu 512 Farben gleichzeitig darstellen konnte. Die HuCard-Module waren kreditkartengross — elegant und platzsparend. Das CD-ROM²-System ermoeglichte CD-Qualitaets-Musik, Sprachausgabe und groessere Spielwelten.",
      "In Nordamerika scheiterte die TurboGrafx-16 jedoch am uebermaechtig Duo aus Nintendo und Sega. Das Marketing war unzureichend, und die aggressive 'Genesis does what Nintendon't'-Kampagne von Sega liess wenig Raum fuer einen dritten Konkurrenten. Trotzdem bleibt die PC Engine eine Lieblingsplattform fuer Sammler, besonders die japanischen CD-ROM²-Titel wie Castlevania: Rondo of Blood und Ys Book I & II."
    ],
    facts: {
      unitsSold: "10 Millionen (geschaetzt, alle Varianten)",
      cpu: "HuC6280 (7,16 MHz)",
      gameLibrary: "686 offizielle Spiele (inkl. CD-ROM²)",
      launchPrice: "24.800 Yen / $199 (1989)",
    },
    milestones: [
      { title: "Castlevania: Rondo of Blood", year: 1993, description: "Eines der besten Action-Plattformer aller Zeiten — lange Japan-exklusiv auf der PC Engine" },
      { title: "Ys Book I & II", year: 1989, description: "CD-ROM-Showcase mit orchestraler Musik und Sprachausgabe — ein RPG-Meilenstein" },
      { title: "Bonk's Adventure", year: 1989, description: "Maskottchen-Plattformer, der zum Gesicht der TurboGrafx-16 wurde" },
      { title: "R-Type (HuCard)", year: 1988, description: "Herausragende Arcade-Portierung, die die PC Engine als Shoot'em'up-Maschine etablierte" },
      { title: "Blazing Lazers", year: 1989, description: "Von Hudson Soft und Compile — einer der besten Shoot'em'ups der 8-/16-Bit-Aera" },
    ],
  },
  {
    platformId: "pcfx",
    manufacturer: "NEC",
    releaseYear: 1994,
    alternateNames: ["PC-FX"],
    history: [
      "Die PC-FX war NECs Nachfolger der erfolgreichen PC Engine — und eine der merkwuerdigsten Konsolen der 90er Jahre. Statt auf 3D-Grafik zu setzen, wie es PlayStation und Saturn taten, konzentrierte sich NEC auf 2D-Grafik und Full-Motion-Video (FMV). Die Konsole war im Grunde eine spezialisierte FMV-Maschine mit herausragender 2D-Faehigkeit, aber ohne jegliche 3D-Beschleunigung.",
      "Diese Entscheidung erwies sich als fatal. Waehrend die Welt 3D-Polygon-Spiele wie Virtua Fighter und Ridge Racer bestaunte, bot die PC-FX hauptsaechlich Anime-Visual-Novels und 2D-Spiele. Die Zielgruppe verengte sich auf Anime-Fans in Japan — ein Nischenmarkt, der nicht ausreichte, um die Konsole am Leben zu halten.",
      "Die PC-FX wurde nie ausserhalb Japans veroeffentlicht und verkaufte sich nur rund 100.000 Mal. Sie markierte das Ende von NECs Konsolengeschaeft. Trotzdem hat sie eine kleine, aber treue Fangemeinde unter Sammlern japanischer Nischenspiele und Anime-Visual-Novels."
    ],
    facts: {
      unitsSold: "ca. 100.000",
      cpu: "NEC V810 (21,5 MHz)",
      gameLibrary: "62 offizielle Spiele",
      launchPrice: "49.800 Yen (1994)",
    },
    milestones: [
      { title: "Tengai Makyou: The Apocalypse IV", year: 1995, description: "Ambitioniertes RPG und meistverkauftes PC-FX-Spiel" },
      { title: "Chip-Chan Kick!", year: 1996, description: "Charmanter Action-Plattformer, der die 2D-Staerken der Hardware nutzte" },
      { title: "Anime Freak FX Vol. 1", year: 1995, description: "Beispiel fuer die Anime-FMV-Ausrichtung der Plattform" },
    ],
  },

  // ── SNK ──
  {
    platformId: "neogeo",
    manufacturer: "SNK",
    releaseYear: 1990,
    alternateNames: ["Neo Geo AES", "Neo Geo MVS (Arcade)"],
    history: [
      "Das Neo Geo war ein einzigartiges Konzept: identische Hardware fuer Spielhallen (MVS — Multi Video System) und fuer zuhause (AES — Advanced Entertainment System). Zum ersten Mal konnten Spieler exakt die gleichen Arcade-Spiele zuhause spielen — ohne Kompromisse bei Grafik oder Gameplay. Der Haken: Der Preis. Die AES-Konsole kostete $649,99, und einzelne Spiele lagen bei $200-$300.",
      "Dieser astronomische Preis machte das Neo Geo zum Luxus-Objekt — zum 'Rolls Royce der Spielkonsolen', wie es in der Werbung hiess. Die Zielgruppe waren wohlhabende Enthusiasten und Arcade-Fanatiker, die bereit waren, fuer die ultimative Spielerfahrung zu zahlen. In Japan waren Neo-Geo-Automaten in jeder Spielhalle zu finden, und der MVS dominierte den Arcade-Markt der 90er Jahre.",
      "SNKs Spielebibliothek war spezialisiert auf Kampfspiele und Shoot'em'ups. The King of Fighters, Fatal Fury, Samurai Shodown und Art of Fighting definierten die 2D-Kampfspiel-Aera. Metal Slug setzte Massstaebe fuer Run'n'Gun-Action. Die Pixel-Art des Neo Geo gilt bis heute als Hoehepunkt der 2D-Grafik — Spiele wie Garou: Mark of the Wolves sehen auch 25 Jahre nach Erscheinen noch fantastisch aus."
    ],
    facts: {
      unitsSold: "ca. 1 Million (AES)",
      cpu: "Motorola 68000 (12 MHz) + Zilog Z80A (4 MHz)",
      gameLibrary: "148 offizielle AES-Spiele",
      launchPrice: "$649,99 (AES, 1990)",
    },
    milestones: [
      { title: "The King of Fighters '98", year: 1998, description: "Gilt als einer der besten 2D-Kaempfer aller Zeiten — perfekt ausbalanciert" },
      { title: "Metal Slug", year: 1996, description: "Meisterwerk der Pixel-Art und des Run'n'Gun-Genres — unuebertroffen in Detailreichtum" },
      { title: "Samurai Shodown II", year: 1994, description: "Waffen-basiertes Kampfspiel mit einzigartigem Tempo und dramatischen Kaempfen" },
      { title: "Garou: Mark of the Wolves", year: 1999, description: "SNKs Meisterwerk — atemberaubende Animation und tiefes Kampfsystem" },
      { title: "Last Blade 2", year: 1998, description: "Elegantes Kampfspiel im feudalen Japan mit wunderschoenem Kunststil" },
    ],
  },
  {
    platformId: "neogeocd",
    manufacturer: "SNK",
    releaseYear: 1994,
    alternateNames: ["Neo Geo CD", "NGCD"],
    history: [
      "Das Neo Geo CD war SNKs Versuch, die prohibitiv teuren AES-Module durch guenstigere CDs zu ersetzen. Die Spiele kosteten nur einen Bruchteil der AES-Module — zwischen $49 und $79 statt $200-$300. Fuer viele Fans war dies endlich der bezahlbare Zugang zur Neo-Geo-Bibliothek.",
      "Das grosse Problem: die Ladezeiten. Das Frontloading-CD-Laufwerk mit nur einfacher Lesegeschwindigkeit fuehrte zu teilweise minuetenlangen Ladezeiten zwischen Kaempfen. In einem Genre, das auf Geschwindigkeit und Fluss angewiesen war, war dies inakzeptabel. SNK versuchte mit dem Neo Geo CDZ (doppelte Lesegeschwindigkeit) gegenzusteuern, doch auch dies reichte nicht.",
      "Trotz der Ladezeiten-Problematik bietet das Neo Geo CD einige exklusive Vorzuege: erweiterte Soundtracks auf CD-Qualitaet, zusaetzliche Animationen und gelegentlich exklusive Inhalte. Fuer Sammler ist das NGCD heute attraktiv, da die Spiele deutlich guenstiger sind als die AES-Module, die teilweise tausende Euro kosten."
    ],
    facts: {
      unitsSold: "ca. 570.000",
      cpu: "Motorola 68000 (12 MHz) + Zilog Z80A (4 MHz)",
      gameLibrary: "98 offizielle Spiele",
      launchPrice: "49.800 Yen / $299 (1994)",
    },
    milestones: [
      { title: "Samurai Shodown RPG", year: 1997, description: "Exklusives RPG auf Basis der beliebten Kampfspiel-Serie" },
      { title: "The King of Fighters '96", year: 1996, description: "Einer der ersten KOF-Titel mit CD-Qualitaets-Soundtrack" },
      { title: "Neo Geo CDZ", year: 1995, description: "Ueberarbeitetes Modell mit doppelter CD-Lesegeschwindigkeit" },
    ],
  },
  {
    platformId: "ngp",
    manufacturer: "SNK",
    releaseYear: 1998,
    alternateNames: ["Neo Geo Pocket", "NGP"],
    history: [
      "Der Neo Geo Pocket war SNKs erster Vorstopp in den Handheld-Markt — ein monochromer Handheld, der nur sechs Monate vor dem farbigen Nachfolger erschien. Er wurde hauptsaechlich in Japan verkauft und bot trotz des monochromen Displays eine beeindruckende Spielequalitaet, insbesondere bei den Kampfspielen.",
      "Das Design war ergonomisch durchdacht und der Mikroswitch-Joystick bot ein herausragendes Steuerungsgefuehl — besonders fuer Kampfspiele war dies ein enormer Vorteil gegenueber dem Game Boy. Die Hardware basierte auf einem Toshiba-TLCS-900H-Prozessor und bot trotz des monochromen Displays fluessige Animationen.",
      "Der NGP wurde schnell vom Neo Geo Pocket Color abgeloest und hatte nur eine kurze Lebensdauer auf dem Markt. Die wenigen veroeffentlichten Titel sind heute seltene Sammlerstuecke. SNK hatte mit dem monochromen Modell den Markt getestet, bevor die verbesserte Farbversion folgte."
    ],
    facts: {
      unitsSold: "Begrenzt (schnell durch NGPC ersetzt)",
      cpu: "Toshiba TLCS-900H (6,144 MHz) + Zilog Z80 (3,072 MHz)",
      gameLibrary: "10 Spiele (Japan-exklusiv)",
      launchPrice: "7.800 Yen (1998)",
    },
    milestones: [
      { title: "King of Fighters R-1", year: 1998, description: "Beeindruckende Handheld-Umsetzung der beliebten Kampfspiel-Serie" },
      { title: "Melon-Chan's Growth Diary", year: 1998, description: "Virtuelles Haustier-Spiel als Launch-Titel" },
      { title: "Neo Geo Pocket Color Ankuendigung", year: 1999, description: "Farbversion wurde schnell zum eigentlichen Fokus von SNKs Handheld-Strategie" },
    ],
  },
  {
    platformId: "ngpc",
    manufacturer: "SNK",
    releaseYear: 1999,
    alternateNames: ["Neo Geo Pocket Color", "NGPC"],
    history: [
      "Der Neo Geo Pocket Color war SNKs Meisterstueck im Handheld-Bereich — ein kleines, elegantes Geraet mit einem herausragenden Mikroswitch-Joystick, der Kampfspiele auf dem Handheld zur Freude machte. In Japan und unter Kampfspiel-Enthusiasten genoss der NGPC hohes Ansehen.",
      "Die Spielebibliothek war zwar klein, aber qualitativ hochwertig. SNK vs. Capcom: Match of the Millennium gilt als eines der besten Handheld-Kampfspiele ueberhaupt. Sonic the Hedgehog Pocket Adventure bot ein exzellentes Sonic-Erlebnis. Card Fighters Clash war ein suchterzeugendes Sammelkartenspiel. SNK schloss sogar eine Kooperation mit Capcom fuer Crossover-Titel.",
      "Trotz der Qualitaet konnte der NGPC nicht gegen Nintendos uebermaechtigen Game Boy Color bestehen. Als SNK im Oktober 2000 Insolvenz anmeldete, wurde der NGPC vom Markt genommen. In Nordamerika hatte er weniger als zwei Jahre ueberlebt. Heute ist er ein begehrtes Sammlerstueck, und seine Spiele erzielen hohe Preise — besonders die englischsprachigen Versionen."
    ],
    facts: {
      unitsSold: "ca. 2 Millionen",
      cpu: "Toshiba TLCS-900H (6,144 MHz) + Zilog Z80 (3,072 MHz)",
      gameLibrary: "82 offizielle Spiele",
      launchPrice: "8.900 Yen / $69,95 (1999)",
    },
    milestones: [
      { title: "SNK vs. Capcom: Match of the Millennium", year: 1999, description: "Eines der besten Handheld-Kampfspiele aller Zeiten mit riesigem Roster" },
      { title: "Sonic the Hedgehog Pocket Adventure", year: 1999, description: "Exzellentes Sonic-Spiel exklusiv fuer den NGPC" },
      { title: "Card Fighters Clash", year: 1999, description: "Genialer SNK-vs.-Capcom-Kartenspiel-Ableger mit hohem Suchtfaktor" },
      { title: "Metal Slug: 1st Mission", year: 1999, description: "Run'n'Gun-Action im Taschenformat mit ueberraschender Spieltiefe" },
    ],
  },

  // ── Bandai ──
  {
    platformId: "wonderswan",
    manufacturer: "Bandai",
    releaseYear: 1999,
    alternateNames: ["WonderSwan", "WS"],
    history: [
      "Der WonderSwan war das letzte Projekt von Gunpei Yokoi, dem legendaeren Game-Boy-Erfinder, der 1996 nach dem Virtual-Boy-Debakel Nintendo verlassen hatte. Yokoi gruendete Koto Laboratory und entwarf fuer Bandai einen Handheld, der seine 'Laterales Denken mit veralteter Technologie'-Philosophie fortsetzte. Tragischerweise starb Yokoi 1997 bei einem Autounfall, bevor der WonderSwan fertiggestellt wurde.",
      "Der WonderSwan war guenstig (nur 4.800 Yen), kompakt und bot innovative Features wie die Moeglichkeit, sowohl horizontal als auch vertikal zu spielen — ideal fuer verschiedene Spielgenres. Er lief mit nur einer AA-Batterie fuer bis zu 30 Stunden. In Japan konnte er dank Lizenzdeals mit Square (Final Fantasy I-IV Remakes) und Bandais eigenem Anime-Katalog kurzzeitig bis zu 8% Marktanteil erobern.",
      "Ausserhalb Japans wurde der WonderSwan nie veroeffentlicht. Die Konkurrenz durch den Game Boy Advance ab 2001 beendete seinen Lebenszyklus frueh. Trotzdem ist der WonderSwan ein wuerdiges Vermaechtnis fuer Gunpei Yokoi — ein elegantes, durchdachtes Geraet, das den Geist des Game Boy in einer neuen Form weiterfuehrte."
    ],
    facts: {
      unitsSold: "3,5 Millionen (inkl. Color/Crystal)",
      cpu: "NEC V30 MZ (3,072 MHz)",
      gameLibrary: "109 offizielle Spiele",
      launchPrice: "4.800 Yen (1999)",
    },
    milestones: [
      { title: "Final Fantasy (WS-Remake)", year: 2000, description: "Square-Remake, das den WonderSwan als RPG-Handheld positionierte" },
      { title: "Gunpey", year: 1999, description: "Puzzle-Spiel benannt nach Gunpei Yokoi — ein wuerdiges Tribut an den Schoepfer" },
      { title: "Digimon", year: 1999, description: "Lizenzspiele, die von Bandais Anime-Katalog profitierten" },
    ],
  },
  {
    platformId: "wsc",
    manufacturer: "Bandai",
    releaseYear: 2000,
    alternateNames: ["WonderSwan Color", "WSC", "SwanCrystal"],
    history: [
      "Der WonderSwan Color war die konsequente Weiterentwicklung des originalen WonderSwan — ein Farbbildschirm mit 241 gleichzeitig darstellbaren Farben aus einer Palette von 4.096. Wie beim Vorgaenger blieb die volle Abwaertskompatibilitaet erhalten, und das Geraet benoetigt weiterhin nur eine einzige AA-Batterie fuer bis zu 20 Stunden Spielzeit.",
      "Die groessten Titel des WSC kamen erneut von Square: Final Fantasy II und IV erhielten hervorragende Farbremakes, und Romancing SaGa erschien ebenfalls auf der Plattform. Der WSC erkaempfte sich in Japan einen respektablen Marktanteil gegen den Game Boy Color — doch die Ankuendigung des Game Boy Advance veraenderte alles.",
      "2002 erschien die letzte Revision, der SwanCrystal, mit einem verbesserten TFT-Display. Doch gegen den technisch ueberlegenen GBA hatte auch er keine Chance. Der WonderSwan Color/Crystal markierte das Ende von Bandais Handheld-Ambitionen. Die Plattform bleibt ein Geheimtipp fuer Sammler japanischer Handhelds mit einigen exzellenten Titeln."
    ],
    facts: {
      unitsSold: "Im Gesamtverkauf von 3,5 Mio. enthalten",
      cpu: "NEC V30 MZ (3,072 MHz)",
      gameLibrary: "91 offizielle Spiele",
      launchPrice: "6.800 Yen (2000)",
    },
    milestones: [
      { title: "Final Fantasy IV (WSC-Remake)", year: 2002, description: "Gelungenes Farbremake des SNES-Klassikers" },
      { title: "Riviera: The Promised Land", year: 2002, description: "Taktik-RPG von Sting, das spaeter auf GBA portiert wurde" },
      { title: "SwanCrystal", year: 2002, description: "Letzte Hardware-Revision mit verbessertem TFT-Display und elegantem Design" },
    ],
  },

  // ── Other Consoles ──
  {
    platformId: "3do",
    manufacturer: "The 3DO Company (Trip Hawkins)",
    releaseYear: 1993,
    alternateNames: ["3DO Interactive Multiplayer", "Panasonic FZ-1", "Goldstar 3DO"],
    history: [
      "Die 3DO war ein einzigartiges Experiment: Trip Hawkins, Gruender von Electronic Arts, entwarf eine Konsolen-Spezifikation, die von verschiedenen Herstellern lizenziert werden konnte. Panasonic, Goldstar (heute LG) und Sanyo produzierten jeweils eigene 3DO-Versionen. Die Idee war, das 'VHS-Modell' auf Konsolen zu uebertragen — ein offener Standard statt proprietaerer Hardware.",
      "Technisch war die 3DO bei ihrer Veroeffentlichung 1993 beeindruckend. 32-Bit-Grafik, CD-ROM, Multimedia-Faehigkeiten — auf dem Papier war sie der Konkurrenz ueberlegen. Doch der Preis von $699,99 war prohibitiv. Zudem fuehrte das Lizenzmodell dazu, dass kein Hersteller den Verlust subventionierte, wie es Sony spaeter mit der PlayStation tat.",
      "Die Spielebibliothek war durchwachsen. Es gab einige Perlen wie Road Rash, Gex und Return Fire, aber auch viel Shovelware und FMV-Spiele. Als die PlayStation 1994 fuer $299 erschien, war die 3DO nicht mehr konkurrenzfaehig. Trip Hawkins' Vision eines offenen Standards war der Zeit voraus — das Konzept funktioniert heute mit Android-basierten Konsolen besser."
    ],
    facts: {
      unitsSold: "ca. 2 Millionen",
      cpu: "ARM60 (12,5 MHz)",
      gameLibrary: "291 offizielle Spiele",
      launchPrice: "$699,99 (Panasonic FZ-1, 1993)",
    },
    milestones: [
      { title: "Road Rash (3DO)", year: 1994, description: "Definitive Version des Motorrad-Kampfrennspiels — meistverkaufter 3DO-Titel" },
      { title: "Gex", year: 1994, description: "Plattformer mit sprechendem Gecko-Maskottchen — wurde zum 3DO-Aushaengeschild" },
      { title: "Return Fire", year: 1995, description: "Multiplayer-Klassiker mit klassischer Musikuntermalung und zerstoerbarer Umgebung" },
    ],
  },
  {
    platformId: "coleco",
    manufacturer: "Coleco",
    releaseYear: 1982,
    alternateNames: ["ColecoVision"],
    history: [
      "Das ColecoVision war 1982 die technisch fortschrittlichste Heimkonsole und bot Arcade-nahe Grafik, die den Atari 2600 alt aussehen liess. Colecos cleverer Schachzug war die Bundlung mit dem Arcade-Hit Donkey Kong — die ColecoVision-Version war der Arcade-Vorlage so nahe, dass sie allein den Kauf rechtfertigte. In den ersten Monaten nach dem Launch wurde die Konsole schneller verkauft als nachproduziert werden konnte.",
      "Coleco bot auch den 'Expansion Module #1' an — einen Adapter, der Atari-2600-Spiele auf dem ColecoVision abspielen konnte. Atari verklagte Coleco daraufhin, doch das Gericht entschied zugunsten von Coleco. Diese aggressive Strategie sicherte der Konsole eine sofortige grosse Spielebibliothek.",
      "Der Videospiel-Crash von 1983 traf auch Coleco hart. Das Unternehmen hatte sich zudem mit dem Adam-Computer uebernommen, der technische Probleme hatte und den Fokus vom Kerngeschaeft ablenkte. 1985 stellte Coleco die ColecoVision ein, und das Unternehmen meldete 1988 Insolvenz an. Trotzdem bleibt die ColecoVision als technischer Meilenstein in Erinnerung."
    ],
    facts: {
      unitsSold: "ca. 6 Millionen",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: "136 offizielle Spiele",
      launchPrice: "$199 (1982)",
    },
    milestones: [
      { title: "Donkey Kong", year: 1982, description: "Bundlespiel und naeherste Arcade-Portierung seiner Zeit — der Systemseller" },
      { title: "Zaxxon", year: 1982, description: "Isometrischer Shoot'em'up, der die grafischen Faehigkeiten der Hardware demonstrierte" },
      { title: "Expansion Module #1", year: 1982, description: "Adapter fuer Atari-2600-Spiele — eine aggressive und erfolgreiche Marktstrategie" },
    ],
  },
  {
    platformId: "vectrex",
    manufacturer: "Smith Engineering / Milton Bradley / GCE",
    releaseYear: 1982,
    alternateNames: ["Vectrex"],
    history: [
      "Der Vectrex war eine der ungewoehnlichsten Konsolen der Videospielgeschichte — er hatte seinen eigenen eingebauten Vektorbildschirm. Waehrend alle anderen Konsolen an einen Fernseher angeschlossen werden mussten, war der Vectrex ein eigenstaendiges Geraet mit integriertem 9-Zoll-Monitor, der gestochen scharfe Vektorgrafiken darstellte, aehnlich wie die Arcade-Klassiker Asteroids und Tempest.",
      "Die Vektorgrafik bot einen einzigartigen visuellen Stil: helle Linien auf schwarzem Hintergrund, ohne die Pixel-Artefakte rasterbasierter Displays. Um den Spielen Farbe zu verleihen, wurden Farbfolien (Screen Overlays) ueber den Bildschirm gelegt — ein charmanter Trick, der an die fruehen Tage des Fernsehens erinnerte.",
      "Der Vectrex erschien genau zum falschen Zeitpunkt — mitten in den Videospiel-Crash von 1983. Milton Bradley, das den Vertrieb uebernahm, stellte die Produktion bereits 1984 ein. Trotzdem geniesst der Vectrex heute hoechsten Kultstatus. Die Homebrew-Szene ist aussergewoehnlich aktiv, und neue Spiele werden bis heute fuer die Plattform entwickelt."
    ],
    facts: {
      unitsSold: "ca. 1 Million (geschaetzt)",
      cpu: "Motorola MC68A09 (1,5 MHz)",
      gameLibrary: "29 offizielle Spiele + zahlreiche Homebrews",
      launchPrice: "$199 (1982)",
    },
    milestones: [
      { title: "Mine Storm", year: 1982, description: "Eingebautes Spiel (Asteroids-aehnlich) — jeder Vectrex hatte es sofort spielbereit" },
      { title: "Star Trek: The Motion Picture", year: 1982, description: "Lizenzspiel, das die Vektorgrafik fuer Weltraumkaempfe perfekt nutzte" },
      { title: "3D Imager", year: 1984, description: "Zubehoer fuer stereoskopisches 3D — visionaer fuer 1984" },
    ],
  },
  {
    platformId: "intellivision",
    manufacturer: "Mattel",
    releaseYear: 1979,
    alternateNames: ["Intellivision", "Mattel Intellivision"],
    history: [
      "Das Intellivision von Mattel war der erste ernsthafte Konkurrent des Atari 2600 und fuehrte den ersten 'Konsolenkrieg' der Geschichte. Mit einem 16-Bit-Prozessor (der ersten 16-Bit-Konsole ueberhaupt, wenn auch mit 10-Bit-Befehlen) bot es bessere Grafik als der Atari 2600. Mattels aggressive Werbung mit George Plimpton verglich direkt die Grafikqualitaet — 'Side-by-Side'-Vergleiche, die den Atari alt aussehen liessen.",
      "Das Intellivision hatte einen einzigartigen Controller mit einer numerischen Tastatur und einer kreisfoermigen Steuerungsscheibe mit 16 Richtungen. Plastikauflagen (Overlays) fuer die Tastatur wurden jedem Spiel beigelegt und zeigten die spielspezifischen Tastenbelegungen. Dieser Controller war innovativ, aber nicht besonders ergonomisch.",
      "Mattels Intellivision-Bibliothek umfasste herausragende Sportspiele, die den Atari-Versionen weit ueberlegen waren. NBA Basketball, NFL Football und MLB Baseball setzten Massstaebe. Auch Titel wie Utopia (ein fruehes Strategiespiel) und Advanced Dungeons & Dragons zeigten die Vielseitigkeit der Plattform. Nach dem Crash von 1983 stellte Mattel die Produktion 1990 endgueltig ein."
    ],
    facts: {
      unitsSold: "ca. 3 Millionen",
      cpu: "General Instrument CP1610 (894 kHz)",
      gameLibrary: "125 offizielle Spiele",
      launchPrice: "$299 (1979)",
    },
    milestones: [
      { title: "Astrosmash", year: 1981, description: "Meistverkauftes Intellivision-Spiel — schnelles Arcade-Gameplay mit High-Score-Jagd" },
      { title: "Advanced Dungeons & Dragons", year: 1982, description: "Erstes offizielles D&D-Videospiel — ein Action-Adventure-Meilenstein" },
      { title: "Utopia", year: 1981, description: "Gilt als erstes Aufbaustrategiespiel der Videospielgeschichte" },
    ],
  },
  {
    platformId: "odyssey2",
    manufacturer: "Magnavox / Philips",
    releaseYear: 1978,
    alternateNames: ["Odyssey 2 (Nordamerika)", "Videopac G7000 (Europa)", "Philips Videopac"],
    history: [
      "Die Odyssey 2, in Europa als Philips Videopac G7000 bekannt, war Magnavox' Nachfolger der allerersten Heimkonsole — der Magnavox Odyssey von 1972. Im Gegensatz zum Atari 2600 hatte die Odyssey 2 eine vollwertige Membrantastatur, was sie als Hybrid zwischen Spielkonsole und Lerncomputer positionierte.",
      "Die Tastatur ermoeglichte einige einzigartige Spielkonzepte. Das Spiel 'Quest for the Rings' kombinierte ein Brettspiel mit der Konsole und nutzte die Tastatur fuer Eingaben. 'Type & Tell' war ein Lernprogramm mit Sprachsynthese — beeindruckend fuer 1982. In Europa war die Odyssey 2/Videopac erfolgreicher als in Nordamerika und verkaufte sich besonders gut in den Niederlanden und Brasilien.",
      "Trotz einiger innovativer Titel blieb die Odyssey 2 technisch hinter dem Atari 2600 zurueck und konnte nicht mit der wachsenden Spielebibliothek des Konkurrenten mithalten. Das bekannteste Spiel, K.C. Munchkin (ein Pac-Man-Klon), wurde nach einer Klage von Atari vom Markt genommen — ironischerweise galt es als das bessere Spiel."
    ],
    facts: {
      unitsSold: "ca. 2 Millionen",
      cpu: "Intel 8048 (1,79 MHz)",
      gameLibrary: "77 offizielle Spiele",
      launchPrice: "$179 (1978)",
    },
    milestones: [
      { title: "K.C. Munchkin!", year: 1981, description: "Pac-Man-inspiriertes Spiel, das nach Ataris Klage vom Markt genommen wurde" },
      { title: "Quest for the Rings", year: 1981, description: "Innovatives Hybrid aus Brettspiel und Videospiel mit Keyboard-Nutzung" },
      { title: "Pick Axe Pete!", year: 1982, description: "Beliebter Plattformer, der zu den besten Odyssey-2-Spielen zaehlt" },
    ],
  },
  {
    platformId: "channelf",
    manufacturer: "Fairchild Semiconductor",
    releaseYear: 1976,
    alternateNames: ["Fairchild Channel F", "Video Entertainment System (VES)"],
    history: [
      "Die Fairchild Channel F war die allererste Heimkonsole mit austauschbaren ROM-Cartridges — ein Jahr vor dem Atari VCS (2600). Entwickelt von Jerry Lawson, einem der wenigen afroamerikanischen Ingenieure in der fruehen Videospielindustrie, war sie ein technologischer Meilenstein. Vor der Channel F waren Konsolen auf fest einprogrammierte Spiele beschraenkt.",
      "Die Channel F bot fuer ihre Zeit fortschrittliche Features: einen eigenen Prozessor (den Fairchild F8), Farbgrafik und sogar einen eingebauten Lautsprecher. Die Controller hatten einen einzigartigen Joystick, der in acht Richtungen bewegt, gedreht und gedrueckt werden konnte. Die Spiele wurden auf 'Videocarts' verteilt — gelbe Plastikmodule.",
      "Doch als der Atari 2600 1977 erschien, konnte die Channel F nicht mithalten. Ataris ueberlegenes Marketing und die staerkere Spielebibliothek verdraengten sie schnell. Fairchild verkaufte die Konsolensparte an Zircon International, die eine ueberarbeitete 'Channel F System II' herausbrachten, bevor die Produktion endgueltig eingestellt wurde. Trotzdem gebuehrt der Channel F der Respekt als Pionierin des modernen Konsolenspiels."
    ],
    facts: {
      unitsSold: "ca. 250.000",
      cpu: "Fairchild F8 (1,79 MHz)",
      gameLibrary: "27 offizielle Videocarts",
      launchPrice: "$169,95 (1976)",
    },
    milestones: [
      { title: "Videocart-1: Tic-Tac-Toe", year: 1976, description: "Einer der ersten austauschbaren Spielmodule der Videospielgeschichte" },
      { title: "Videocart-2: Desert Fox/Shooting Gallery", year: 1976, description: "Panzer- und Schiess-Spiel, das die Moeglichkeiten des Systems demonstrierte" },
      { title: "Jerry Lawsons Vermaechtnis", year: 1976, description: "Der afroamerikanische Ingenieur Jerry Lawson erfand das Cartridge-System und praegte die Industrie" },
    ],
  },

  // ── Computers ──
  {
    platformId: "dos",
    manufacturer: "IBM / Microsoft",
    releaseYear: 1981,
    alternateNames: ["MS-DOS", "PC-DOS", "IBM PC"],
    history: [
      "MS-DOS war kein Spielsystem im klassischen Sinne — es war das Betriebssystem, auf dem die PC-Gaming-Revolution stattfand. Von den fruehen Textadventures ueber die Sierra-und-LucasArts-Aera bis hin zu den ersten Ego-Shootern praegte DOS ueber 15 Jahre lang das Computer-Gaming. Die offene PC-Architektur ermoeglichte staendige Hardware-Upgrades, was zu einem Wettruestung fuehrte, die Konsolen nicht bieten konnten.",
      "Die fruehen 80er Jahre gehoerten Textadventures von Infocom (Zork) und den Anfaengen der Sierra-On-Line-Aera. In den spaten 80ern revolutionierten LucasArts (Monkey Island, Indiana Jones) und Sierra (King's Quest, Space Quest) das Adventure-Genre. Die 90er brachten dann den Ego-Shooter-Boom: Wolfenstein 3D (1992), Doom (1993) und Quake (1996) veraenderten die Spielelandschaft fuer immer.",
      "DOS-Gaming war auch die Heimat der Strategiespiele (Civilization, X-COM, Command & Conquer), der RPGs (Ultima, Baldur's Gate) und der Simulationen (SimCity, Flight Simulator). Die Aera endete Mitte der 90er mit dem Aufstieg von Windows 95, doch dank DOSBox lebt das DOS-Gaming-Erbe weiter — tausende Klassiker sind heute einfacher zugaenglich als je zuvor."
    ],
    facts: {
      unitsSold: "Hunderte Millionen PCs (plattformuebergreifend)",
      cpu: "Intel 8088 bis Pentium (4,77 MHz bis 200+ MHz)",
      gameLibrary: "Tausende Spiele",
      launchPrice: "$1.565 (IBM PC, 1981)",
    },
    milestones: [
      { title: "Doom", year: 1993, description: "Definierte den Ego-Shooter und popularisierte LAN-Multiplayer — ein kulturelles Phaenomen" },
      { title: "The Secret of Monkey Island", year: 1990, description: "LucasArts' Meisterwerk mit SCUMM-Engine — Humor und Raetsel perfekt vereint" },
      { title: "Sid Meier's Civilization", year: 1991, description: "Begruendete das Strategiespiel-Genre 'Noch eine Runde' — bis heute eine der einflussreichsten Serien" },
      { title: "Wolfenstein 3D", year: 1992, description: "Der 'Grossvater' der Ego-Shooter — ebnete den Weg fuer Doom" },
      { title: "X-COM: UFO Defense", year: 1994, description: "Perfekte Mischung aus Taktik und Strategie — wurde 2012 erfolgreich wiederbelebt" },
    ],
  },
  {
    platformId: "c64",
    manufacturer: "Commodore",
    releaseYear: 1982,
    alternateNames: ["Commodore 64", "C64", "CBM 64", "Brotkasten"],
    history: [
      "Der Commodore 64 ist der meistverkaufte Einzelcomputer aller Zeiten — zwischen 12,5 und 17 Millionen Einheiten, je nach Quelle. In Deutschland liebevoll 'Brotkasten' genannt, praegte er eine ganze Generation von Spielern und Programmierern. Fuer viele Europaeer war der C64 der Einstieg in die Welt der Computer und Videospiele.",
      "Der SID-Soundchip (MOS 6581/8580) war ein akustisches Wunderwerk. Mit drei Stimmen und programmierbaren Filtern ermoeglichte er Musik, die fuer einen 8-Bit-Computer unglaublich klang. Komponisten wie Rob Hubbard, Martin Galway und Ben Daglish schufen Soundtracks, die bis heute gefeiert werden. Die SID-Musik-Szene lebt bis heute als 'Chiptune'-Bewegung weiter.",
      "Die Spielebibliothek des C64 war gigantisch — ueber 10.000 kommerzielle Titel erschienen. In Europa dominierte der C64 den Heimcomputer-Markt der 80er Jahre. Klassiker wie Impossible Mission, Maniac Mansion, Pitstop II, The Last Ninja und Boulder Dash praegten die Spielekultur. Auch die Cracking- und Demo-Szene hatte auf dem C64 ihren Ursprung — Gruppen wie Fairlight und 1001 Crew begannen hier."
    ],
    facts: {
      unitsSold: "12,5-17 Millionen",
      cpu: "MOS 6510 (1,023 MHz PAL / 1,023 MHz NTSC)",
      gameLibrary: "10.000+ Spiele",
      launchPrice: "$595 (1982)",
    },
    milestones: [
      { title: "Impossible Mission", year: 1984, description: "Digitalisierte Sprachausgabe ('Stay a while... stay forever!') und Puzzle-Plattformer-Perfektion" },
      { title: "The Last Ninja", year: 1987, description: "Isometrisches Action-Adventure mit beeindruckender Grafik und Atmosphaere" },
      { title: "Maniac Mansion", year: 1987, description: "LucasArts' erstes SCUMM-Adventure — begruendete eine neue Aera der Point-and-Click-Spiele" },
      { title: "Boulder Dash", year: 1984, description: "Suchterzeugendes Puzzle-Action-Spiel, das bis heute Nachahmer inspiriert" },
      { title: "International Karate +", year: 1987, description: "Eines der besten Kampfspiele der 8-Bit-Aera von Archer MacLean" },
    ],
  },
  {
    platformId: "amiga",
    manufacturer: "Commodore",
    releaseYear: 1985,
    alternateNames: ["Commodore Amiga", "Amiga 500", "Amiga 1200", "A500", "A1200"],
    history: [
      "Der Amiga war seiner Zeit um Jahre voraus. Als er 1985 erschien, bot er praeemptives Multitasking, eine grafische Benutzeroberflaeche und Custom-Chips fuer Grafik und Sound, die alles in den Schatten stellten. Der Amiga 500 (1987) wurde zum meistverkauften Modell und zum Inbegriff des europaeischen Home-Computings der spaten 80er und fruehen 90er Jahre.",
      "Besonders im Bereich Multimedia war der Amiga revolutionaer. Video Toaster verwandelte ihn in eine semi-professionelle Videobearbeitungsstation — die Spezialeffekte der TV-Serie Babylon 5 und fruehe Sendungen von MTV wurden auf Amigas produziert. In der Demoszene war der Amiga die Referenzplattform, und Gruppen wie The Black Lotus und Sanity schufen atemberaubende audiovisuelle Kunstwerke.",
      "Als Spieleplattform war der Amiga unuebertroffen. Die Bitmap Brothers (Speedball 2, The Chaos Engine), Team17 (Worms, Alien Breed), Sensible Software (Sensible World of Soccer) und unzaehlige andere Studios lieferten Meisterwerke. Der Amiga praegte die europaeische Spieleentwicklung massgeblich — viele der groessten britischen und skandinavischen Studios haben ihre Wurzeln auf dem Amiga."
    ],
    facts: {
      unitsSold: "ca. 6 Millionen (alle Modelle)",
      cpu: "Motorola 68000 (7,14 MHz, A500)",
      gameLibrary: "5.000+ Spiele",
      launchPrice: "$1.295 (Amiga 1000, 1985) / $699 (Amiga 500, 1987)",
    },
    milestones: [
      { title: "Lemmings", year: 1991, description: "Von DMA Design (spaeter Rockstar North) — eines der einflussreichsten Puzzlespiele aller Zeiten" },
      { title: "Speedball 2: Brutal Deluxe", year: 1990, description: "Bitmap Brothers' futuristisches Sport-Action-Spiel — Perfektion in Leveldesign und Gameplay" },
      { title: "Sensible World of Soccer", year: 1994, description: "Legendaeres Fussballspiel mit ueber 27.000 realen Spielern — bis heute unerreicht im Suchtfaktor" },
      { title: "Turrican II", year: 1991, description: "Factors 5 Action-Meisterwerk mit einem der besten Soundtracks der 16-Bit-Aera (Chris Huelsbeck)" },
      { title: "Shadow of the Beast", year: 1989, description: "Technische Demo der Amiga-Hardware mit Parallax-Scrolling auf 13 Ebenen" },
    ],
  },
  {
    platformId: "msx",
    manufacturer: "Microsoft / ASCII Corporation (Standard)",
    releaseYear: 1983,
    alternateNames: ["MSX", "MSX2", "MSX2+", "MSX turboR"],
    history: [
      "MSX war kein einzelner Computer, sondern ein offener Hardware-Standard, initiiert von Kazuhiko Nishi (ASCII Corporation) in Zusammenarbeit mit Microsoft. Die Idee: Verschiedene Hersteller (Sony, Panasonic, Philips, Yamaha und viele mehr) produzieren kompatible Computer, sodass Software universell laeuft. In Japan, Korea und Teilen Europas (besonders den Niederlanden und Spanien) war MSX ein grosser Erfolg.",
      "Der MSX wurde zur Geburtsstatte einiger der bekanntesten Spieleserien. Hideo Kojimas Metal Gear erschien 1987 zuerst auf dem MSX2 — die NES-Version war ein minderwertiger Port. Konami unterstuetzte die Plattform hervorragend mit Titeln wie Vampire Killer (Castlevania), Penguin Adventure (fruehes Werk von Kojima) und Nemesis (Gradius). Auch die Bomberman-Serie hatte ihren Ursprung auf dem MSX.",
      "Der Standard entwickelte sich ueber vier Generationen: MSX (1983), MSX2 (1985) mit verbesserter Grafik, MSX2+ (1988) mit Hardware-Scrolling und MSX turboR (1990) mit 16-Bit-Prozessor. In Japan hielt sich die Plattform bis Anfang der 90er. Die MSX-Community ist bis heute aktiv, und der Standard wird als wichtiger Beitrag zur japanischen Spielegeschichte gewuerdigt."
    ],
    facts: {
      unitsSold: "ca. 5 Millionen (alle Varianten weltweit)",
      cpu: "Zilog Z80A (3,58 MHz)",
      gameLibrary: "2.000+ Spiele",
      launchPrice: "Variierte je nach Hersteller (ca. 50.000-100.000 Yen)",
    },
    milestones: [
      { title: "Metal Gear", year: 1987, description: "Hideo Kojimas erstes Metal Gear erschien auf dem MSX2 — die definitive Version" },
      { title: "Vampire Killer", year: 1986, description: "Die MSX2-Version von Castlevania mit eigenstaendigem, explorationslastigem Gameplay" },
      { title: "Penguin Adventure", year: 1986, description: "Fruehes Werk von Hideo Kojima mit ueberraschendem Tiefgang fuer ein Pinguinspiel" },
      { title: "Space Manbow", year: 1989, description: "Konamis technisch beeindruckender Shoot'em'up fuer den MSX2" },
    ],
  },
  {
    platformId: "zxspectrum",
    manufacturer: "Sinclair Research",
    releaseYear: 1982,
    alternateNames: ["ZX Spectrum", "Speccy", "Sinclair Spectrum"],
    history: [
      "Der ZX Spectrum von Sir Clive Sinclair war der Computer, der die britische Spieleindustrie begruendete. Mit einem Preis von nur 125 Pfund (fuer die 16K-Version) war er erschwinglich genug, um in britische Kinderzimmer und Wohnungen einzuziehen. Die markante Gummitastatur und der Regenbogenstreifen am Gehaeuse wurden zu Ikonen der 80er Jahre.",
      "Die Spieleindustrie, die sich um den Spectrum bildete, war einzigartig. Jugendliche Programmierer wie Matthew Smith (Manic Miner, Jet Set Willy), die Oliver Twins (Dizzy) und Ultimate Play the Game (spaeter Rare!) gruendeten in ihren Kinderzimmern Studios, die die britische Gaming-Landschaft praegten. Der Spectrum war die Wiege von Rare, Codemasters, Psygnosis und vielen anderen legendaeren Studios.",
      "Software wurde auf handelsueblichen Audiokassetten verteilt — das Laden eines Spiels dauerte mehrere Minuten und wurde von charakteristischem Piepen und bunten Bildschirmstreifen begleitet. Trotz der bescheidenen Hardware (nur 8 Farben pro 8x8-Pixel-Block, was zum beruehmten 'Colour Clash' fuehrte) erschienen tausende Spiele. In den ehemaligen Ostblockstaaten, besonders Russland, war der Spectrum durch Klone wie den 'Pentagon' noch bis in die 90er Jahre populaer."
    ],
    facts: {
      unitsSold: "ca. 5 Millionen (offizielle Modelle)",
      cpu: "Zilog Z80A (3,5 MHz)",
      gameLibrary: "10.000+ Spiele",
      launchPrice: "125 Pfund (16K) / 175 Pfund (48K, 1982)",
    },
    milestones: [
      { title: "Manic Miner", year: 1983, description: "Von Matthew Smith mit 16 Jahren programmiert — begruendete den britischen Plattformer" },
      { title: "Jet Set Willy", year: 1984, description: "Open-World-Plattformer, der in Grossbritannien zum kulturellen Phaenomen wurde" },
      { title: "Elite", year: 1985, description: "Revolutionaerer 3D-Weltraumsimulator von David Braben und Ian Bell — 8 Galaxien auf 48K" },
      { title: "Knight Lore", year: 1984, description: "Ultimates isometrisches Meisterwerk — praegte die 'Filmation'-Engine und das isometrische Genre" },
    ],
  },
  {
    platformId: "amstrad",
    manufacturer: "Amstrad",
    releaseYear: 1984,
    alternateNames: ["Amstrad CPC", "CPC 464", "CPC 6128", "GX4000"],
    history: [
      "Der Amstrad CPC (Colour Personal Computer) war Alan Sugars Antwort auf den Heimcomputerboom der fruehen 80er Jahre. Der clevere Schachzug: Der CPC 464 wurde als Komplettpaket mit integriertem Kassettenlaufwerk und Monitor verkauft — keine Basteleien mit dem Familienfernseher noetig. In Grossbritannien, Frankreich und Spanien war der CPC ein grosser Erfolg.",
      "Technisch lag der CPC zwischen dem ZX Spectrum und dem Commodore 64. Er hatte einen aehnlichen Prozessor wie der Spectrum, bot aber eine bessere Farbdarstellung (27 Farben) und einen eingebauten Soundchip (AY-3-8912). In Frankreich war der CPC zeitweise der beliebteste Heimcomputer und hatte eine lebhafte eigene Spieleentwicklerszene.",
      "1990 versuchte Amstrad mit dem GX4000 den Sprung in den Konsolenmarkt — eine reine Spielkonsole basierend auf der CPC-Plus-Hardware. Der Versuch scheiterte klaglich, da der Markt bereits vom Mega Drive und Super Nintendo dominiert wurde. Der GX4000 wurde nach nur sechs Monaten eingestellt. Trotzdem bleibt der CPC ein wichtiger Teil der europaeischen Computergeschichte."
    ],
    facts: {
      unitsSold: "ca. 3 Millionen",
      cpu: "Zilog Z80A (4 MHz)",
      gameLibrary: "3.000+ Spiele",
      launchPrice: "199 Pfund (CPC 464 mit Gruenmonitor, 1984)",
    },
    milestones: [
      { title: "Gryzor (Contra)", year: 1987, description: "Herausragende Portierung des Arcade-Klassikers — eines der besten CPC-Spiele" },
      { title: "Renegade", year: 1987, description: "Beat'em'up-Klassiker, der auf dem CPC hervorragend umgesetzt wurde" },
      { title: "GX4000-Launch", year: 1990, description: "Amstrads gescheiterter Versuch, mit einer CPC-basierten Konsole in den Konsolenmarkt einzusteigen" },
    ],
  },
  {
    platformId: "bbcmicro",
    manufacturer: "Acorn Computers",
    releaseYear: 1981,
    alternateNames: ["BBC Micro", "BBC Microcomputer", "Beeb"],
    history: [
      "Der BBC Micro entstand aus einem ambitionierten Bildungsprogramm der British Broadcasting Corporation (BBC). Das Ziel: Computer-Kompetenz in ganz Grossbritannien foerdern. Acorn Computers gewann die Ausschreibung gegen Sinclair und lieferte einen robusten, erweiterbaren Computer, der zum Standard in britischen Schulen wurde. Eine ganze Generation britischer Programmierer lernte auf dem 'Beeb'.",
      "Technisch war der BBC Micro seiner Zeit voraus. Die fortschrittliche BBC BASIC-Implementierung mit integriertem Assembler, schnelle Grafikmodi und zahlreiche Erweiterungsports machten ihn zur idealen Lernplattform. David Braben und Ian Bell entwickelten 'Elite' urspruenglich auf dem BBC Micro — das revolutionaere 3D-Weltraumspiel, das die gesamte Branche beeinflusste.",
      "Acorn Computers, der Hersteller des BBC Micro, entwickelte spaeter die ARM-Prozessorarchitektur fuer den Nachfolger Archimedes. ARM — heute in praktisch jedem Smartphone der Welt verbaut — hat seinen Ursprung direkt in der BBC-Micro-Aera. So fuehrte ein Bildungsprojekt der 80er Jahre indirekt zur dominantesten Chiparchitektur des 21. Jahrhunderts."
    ],
    facts: {
      unitsSold: "ca. 1,5 Millionen",
      cpu: "MOS 6502A (2 MHz)",
      gameLibrary: "2.000+ Spiele und Programme",
      launchPrice: "235 Pfund (Model A) / 335 Pfund (Model B, 1981)",
    },
    milestones: [
      { title: "Elite", year: 1984, description: "Revolutionaeres 3D-Weltraumspiel — urspruenglich auf dem BBC Micro entwickelt" },
      { title: "Repton", year: 1985, description: "Beliebtes Puzzle-Spiel, das zum BBC-Micro-Klassiker wurde" },
      { title: "ARM-Prozessor-Entwicklung", year: 1985, description: "Acorn entwickelte ARM fuer den Nachfolger — heute in Milliarden von Geraeten verbaut" },
    ],
  },
  {
    platformId: "x68000",
    manufacturer: "Sharp",
    releaseYear: 1987,
    alternateNames: ["Sharp X68000", "X68K"],
    history: [
      "Der Sharp X68000 war die ultimative Arcade-zu-Hause-Maschine — ein japanischer Heimcomputer, der dank seiner Motorola-68000-CPU und der leistungsfaehigen Custom-Chips originalgetreue Arcade-Portierungen ermoeglichte. Capcom nutzte den X68000 sogar als Entwicklungsplattform fuer seine CPS-1-Arcade-Spiele, was zu nahezu perfekten Portierungen fuehrte.",
      "Das auffaellige Design des X68000 — ein futuristisches Doppeltower-Gehaeuse — war ebenso unverwechselbar wie seine technischen Faehigkeiten. Die Hardware bot 65.536 Farben, Hardware-Sprites, Scrolling-Ebenen und FM-Sound — alles, was fuer Arcade-perfekte Umsetzungen noetig war. Street Fighter II, Gradius, Castlevania Chronicles und Final Fight gehhoerten zu den herausragenden Titeln.",
      "Der X68000 war ausschliesslich in Japan erhaeltlich und blieb dort ein Nischenprodukt fuer Enthusiasten. Der hohe Preis (knapp 370.000 Yen beim Launch) beschraenkte die Zielgruppe. Trotzdem geniesst der X68000 heute Legendenstatus unter Retro-Computing-Fans als die Plattform mit den besten Arcade-Portierungen der 16-Bit-Aera."
    ],
    facts: {
      unitsSold: "ca. 300.000 (geschaetzt)",
      cpu: "Motorola MC68000 (10 MHz)",
      gameLibrary: "600+ Spiele und Anwendungen",
      launchPrice: "369.000 Yen (1987)",
    },
    milestones: [
      { title: "Castlevania Chronicles", year: 1993, description: "Eigenstaendiges Castlevania exklusiv fuer den X68000 — spaeter auf PS1 portiert" },
      { title: "Street Fighter II' (X68000)", year: 1993, description: "Eine der originalgetreuesten Portierungen des Arcade-Klassikers" },
      { title: "Gradius II", year: 1992, description: "Arcade-perfekte Portierung, die die Hardware-Faehigkeiten voll ausreizte" },
    ],
  },

  // ── Arcade ──
  {
    platformId: "arcade",
    manufacturer: "Diverse (Namco, Capcom, Sega, SNK, Konami u.a.)",
    releaseYear: 1971,
    alternateNames: ["Spielhalle", "Coin-Op", "MAME", "FBNeo"],
    history: [
      "Die Arcade-Spielhalle war der Geburtsort der Videospielindustrie. Von Pong (1972) ueber Space Invaders (1978) bis zu Street Fighter II (1991) — die groessten Meilensteine der Spielegeschichte begannen als muenzbetriebene Automaten. In den fruehen 80ern erreichte die 'Arcade-Goldene-Aera' ihren Hoehepunkt: Pac-Man wurde zum globalen Kulturphaenomen, und Spielhallen waren soziale Treffpunkte fuer eine ganze Generation.",
      "Die 90er Jahre brachten die 3D-Revolution: Segas Virtua Fighter (1993), Namcos Ridge Racer (1993) und Midways Mortal Kombat (1992) zeigten, dass Arcade-Hardware den Heimkonsolen noch Jahre voraus war. Capcom dominierte mit dem CPS-2-System und der Street-Fighter-II-Serie das Fighting-Game-Genre. SNKs Neo Geo MVS bot bis zu sechs Spiele in einem Automaten.",
      "Mit steigender Leistung der Heimkonsolen verlor die Arcade ab Ende der 90er Jahre in westlichen Laendern an Bedeutung. In Japan blieben Spielhallen jedoch ein wichtiger Teil der Gaming-Kultur — bis heute. MAME (Multiple Arcade Machine Emulator) und FBNeo bewahren das Arcade-Erbe digital fuer zukuenftige Generationen."
    ],
    facts: {
      unitsSold: "Nicht anwendbar (Automaten-System)",
      cpu: "Variiert je nach Board (Z80, 68000, MIPS, ARM u.v.m.)",
      gameLibrary: "Zehntausende Spiele ueber 50+ Jahre",
      launchPrice: "Variiert ($2.000-$25.000+ pro Automat)",
    },
    milestones: [
      { title: "Pac-Man", year: 1980, description: "Erstes Gaming-Kulturphaenomen — generierte ueber 2,5 Milliarden Dollar in Muenzen" },
      { title: "Street Fighter II", year: 1991, description: "Begruendete das moderne Fighting-Game-Genre und die Turnierszene" },
      { title: "Space Invaders", year: 1978, description: "Loeste in Japan eine 100-Yen-Muenz-Knappheit aus — das erste Blockbuster-Videospiel" },
      { title: "Donkey Kong", year: 1981, description: "Debuet von Mario und Shigeru Miyamatos erstes Meisterwerk" },
      { title: "Daytona USA", year: 1993, description: "Segas Model-2-Meilenstein mit unvergesslichem Soundtrack und Grafik" },
    ],
  },
  {
    platformId: "naomi",
    manufacturer: "Sega",
    releaseYear: 1998,
    alternateNames: ["Sega NAOMI", "NAOMI 2", "NAOMI GD-ROM", "New Arcade Operation Machine for Interactive"],
    history: [
      "Das Sega NAOMI-Board war technisch identisch mit dem Dreamcast — jedoch mit doppelt so viel Arbeitsspeicher (32 MB statt 16 MB). Dieses Verwandtschaftsverhaeltnis ermoeglichte einfache Portierungen zwischen Arcade und Heimkonsole und machte den Dreamcast zum idealen Begleiter fuer Arcade-Fans. NAOMI-Spiele konnten auf ROM-Boards oder GD-ROMs ausgeliefert werden.",
      "Die NAOMI-Plattform war kommerziell aeusserst erfolgreich und lief in Spielhallen weltweit von 1998 bis weit in die 2000er Jahre. Titel wie Crazy Taxi, Virtua Tennis, Marvel vs. Capcom 2, Ikaruga und The House of the Dead 2 definierten die spaete Arcade-Aera. Das NAOMI 2 (2001) verdoppelte die Grafikleistung und bot Spiele wie Virtua Fighter 4 und Beach Spikers.",
      "NAOMI war auch die Basis fuer Varianten wie das Sammy Atomiswave und das Sega Hikaru. Das System bewies, dass kostenguenstige, Dreamcast-basierte Arcade-Hardware hochprofitable Titel hervorbringen konnte — viele Spielhallen nutzten NAOMI-Boards bis in die 2010er Jahre."
    ],
    facts: {
      unitsSold: "Arcade-System (weit verbreitet in Spielhallen weltweit)",
      cpu: "Hitachi SH4 (200 MHz, wie Dreamcast)",
      gameLibrary: "170+ Titel (NAOMI + NAOMI 2)",
      launchPrice: "Arcade-System",
    },
    milestones: [
      { title: "Marvel vs. Capcom 2", year: 2000, description: "56 spielbare Charaktere — eines der beliebtesten Fighting Games aller Zeiten" },
      { title: "Ikaruga", year: 2001, description: "Treasures Meisterwerk des Polaritaets-Shoot'em'up-Genres" },
      { title: "Virtua Tennis", year: 1999, description: "Definierte das Arcade-Tennisspiel mit intuitivem Gameplay und suchterzeugendem Mehrspieler" },
      { title: "Crazy Taxi", year: 1999, description: "Arcade-Spass pur — spaeter als Dreamcast-Bestseller portiert" },
    ],
  },
  {
    platformId: "atomiswave",
    manufacturer: "Sammy Corporation",
    releaseYear: 2003,
    alternateNames: ["Sammy Atomiswave", "AW"],
    history: [
      "Das Sammy Atomiswave war ein kostenguenstiges Arcade-System, das auf einer modifizierten Sega-NAOMI-Architektur basierte. Sammy hatte die Rechte von Sega erworben und ein System entwickelt, das Spielhallenbetreibern eine guenstige Alternative zu teureren Arcade-Boards bot. Das Atomiswave nutzte austauschbare ROM-Cartridges statt GD-ROMs, was die Kosten weiter senkte.",
      "Trotz seiner bescheidenen technischen Spezifikationen beherbergte das Atomiswave einige bemerkenswerte Titel. SNK Playmore (die Nachfolgefirma von SNK) unterstuetzte die Plattform mit King of Fighters NeoWave, Samurai Shodown V und Metal Slug 6. Auch Segas Fist of the North Star und Dolphin Blue erschienen auf dem System.",
      "Das Atomiswave war vor allem in Japan und Asien verbreitet und wurde bis etwa 2008 in Spielhallen eingesetzt. Viele Atomiswave-Titel wurden spaeter auf die Dreamcast- und PS2-Plattform portiert. Das System markierte einen der letzten Versuche, dedizierte 2D-Arcade-Hardware auf den Markt zu bringen, bevor die Arcade-Industrie zunehmend auf PC-basierte Loesungen umstieg."
    ],
    facts: {
      unitsSold: "Arcade-System (begrenzte Verbreitung)",
      cpu: "Hitachi SH4 (200 MHz, NAOMI-basiert)",
      gameLibrary: "27 offizielle Spiele",
      launchPrice: "Arcade-System",
    },
    milestones: [
      { title: "Metal Slug 6", year: 2006, description: "Erster Metal Slug auf nicht-Neo-Geo-Hardware mit neuem Charakter-Wahl-System" },
      { title: "Samurai Shodown V", year: 2003, description: "SNK Playmores Rueckkehr zur beliebten Kampfspiel-Serie" },
      { title: "Dolphin Blue", year: 2003, description: "Sega-Run'n'Gun mit Unterwasser-Thematik und klassischem Arcade-Gameplay" },
    ],
  },

  // ── Other ──
  {
    platformId: "scummvm",
    manufacturer: "LucasArts / Community-Projekt",
    releaseYear: 1987,
    alternateNames: ["ScummVM", "SCUMM", "Script Creation Utility for Maniac Mansion"],
    history: [
      "SCUMM (Script Creation Utility for Maniac Mansion) war die revolutionaere Spiel-Engine, die LucasArts 1987 fuer Maniac Mansion entwickelte. Die Point-and-Click-Oberflaeche ersetzte das muehsame Tippen von Textbefehlen durch eine intuitive Verben-Leiste, die das Adventure-Genre fuer ein breites Publikum oeeffnete. Die SCUMM-Engine wurde ueber ein Jahrzehnt weiterentwickelt und trieb die besten Adventures der Spielegeschichte an.",
      "Von Maniac Mansion ueber The Secret of Monkey Island, Indiana Jones and the Fate of Atlantis und Day of the Tentacle bis zu The Curse of Monkey Island — SCUMM-Spiele definierten das goldene Zeitalter der Point-and-Click-Adventures. Tim Schafer, Ron Gilbert und Dave Grossman schufen mit diesen Spielen Geschichten, die Humor, Raetsel und Emotion perfekt vereinten.",
      "ScummVM, das Community-Projekt zur Emulation der SCUMM-Engine (und mittlerweile dutzender weiterer Adventure-Engines), macht diese Klassiker auf modernen Systemen spielbar. Das Open-Source-Projekt unterstuetzt heute ueber 325 Spiele von LucasArts, Sierra, Revolution Software und vielen anderen Studios. ScummVM ist damit einer der wichtigsten Beitraege zur Bewahrung des Adventure-Erbes."
    ],
    facts: {
      unitsSold: "Nicht anwendbar (Software-Engine/Emulator)",
      cpu: "Variiert je nach Hostplattform",
      gameLibrary: "325+ unterstuetzte Spiele",
      launchPrice: "Kostenlos (Open Source)",
    },
    milestones: [
      { title: "The Secret of Monkey Island", year: 1990, description: "Ron Gilberts Meisterwerk — definierte das humorvolle Point-and-Click-Adventure" },
      { title: "Day of the Tentacle", year: 1993, description: "Tim Schafers Zeitreise-Comedy gilt als eines der besten Adventures ueberhaupt" },
      { title: "Grim Fandango", year: 1998, description: "Film-Noir-Adventure im Land der Toten — kuenstlerisch einzigartig" },
      { title: "ScummVM 1.0 Release", year: 2009, description: "Erster stabiler Release des Community-Projekts nach acht Jahren Entwicklung" },
      { title: "Indiana Jones and the Fate of Atlantis", year: 1992, description: "Gilt als das beste Indiana-Jones-Abenteuer — besser als mancher Film der Reihe" },
    ],
  },
  {
    platformId: "pico8",
    manufacturer: "Lexaloffle Games (Joseph White)",
    releaseYear: 2015,
    alternateNames: ["PICO-8", "Fantasy Console"],
    history: [
      "PICO-8 ist eine 'Fantasy Console' — ein virtuelles Spielsystem mit absichtlichen Limitierungen, das nie als physische Hardware existierte. Entwickelt von Joseph White (Lexaloffle Games), beschraenkt PICO-8 Spiele auf 128x128 Pixel Aufloesung, eine feste 16-Farben-Palette, 4-Kanal-Chiptune-Sound und maximal 8.192 Token Lua-Code. Diese Beschraenkungen sind kein Fehler — sie sind das Feature.",
      "Die bewussten Limitierungen foerdern Kreativitaet durch Begrenzung. Entwickler muessen jedes Pixel, jeden Ton und jede Codezeile mit Bedacht einsetzen. Das Ergebnis ist eine lebendige Community, die tausende charmanter Minispiele produziert hat. PICO-8-Spiele werden als 'Cartridges' in PNG-Bildern gespeichert — der Code ist im Bild selbst versteckt.",
      "Celeste begann als PICO-8-Prototyp, bevor es zu einem der meistgefeierten Indie-Spiele der Geschichte wurde. Die PICO-8-Community trifft sich auf dem Lexaloffle-Forum und teilt ihre Kreationen. Die Fantasy Console hat eine neue Generation von Spieleentwicklern inspiriert und beweist, dass Limitierungen die beste Kreativitaetsschule sind."
    ],
    facts: {
      unitsSold: "Nicht anwendbar (Virtuelle Konsole / Software)",
      cpu: "Virtueller Lua-basierter Prozessor",
      gameLibrary: "Tausende Community-Spiele",
      launchPrice: "$14,99 (Software-Lizenz)",
    },
    milestones: [
      { title: "Celeste (PICO-8 Prototyp)", year: 2016, description: "Ursprungsversion des spaeter preisgekroenten Indie-Plattformers" },
      { title: "PICO-8 Zine", year: 2015, description: "Community-Magazin, das Tutorials und Spiele-Highlights praesentiert" },
      { title: "Splore Browser", year: 2016, description: "Eingebauter Spiele-Browser zum direkten Herunterladen und Spielen von Community-Spielen" },
    ],
  },
  {
    platformId: "steam",
    manufacturer: "Valve Corporation",
    releaseYear: 2003,
    alternateNames: ["Steam", "Valve Steam"],
    history: [
      "Steam begann 2003 als simples Update-System fuer Counter-Strike und Half-Life 2 — und wurde von Spielern zunaechst gehasst. Die Pflicht, sich fuer Half-Life 2 bei Steam anzumelden, loeste einen Sturm der Entruestung aus. Doch Gabe Newell, Valve-Mitgruender, hatte eine langfristige Vision: eine zentrale Plattform fuer den digitalen Spielevertrieb.",
      "Der Wendepunkt kam mit den Steam Sales. Die legendaeren Sommer- und Winter-Sales mit Rabatten von 50-90% veraenderten das Kaufverhalten von Millionen Spielern. Indie-Entwickler fanden auf Steam ein riesiges Publikum: Spiele wie Undertale, Stardew Valley, Hollow Knight und Hades wurden zu Millionensellern. Der Steam Workshop ermoeglichte es Spielern, Mods direkt ueber die Plattform zu teilen.",
      "Heute ist Steam mit ueber 30.000 Spielen und ueber 120 Millionen monatlich aktiven Nutzern die dominante PC-Gaming-Plattform. Das Steam Deck (2022) brachte das Steam-Oekosystem auch auf einen Handheld. Valves Einfluss auf die Gaming-Industrie durch Steam ist kaum zu ueberschaetzen — digitale Spielelaeden wie Epic Games Store, GOG und der PlayStation Store waeren ohne Steams Pionierarbeit undenkbar."
    ],
    facts: {
      unitsSold: "120+ Millionen monatlich aktive Nutzer",
      cpu: "Nicht anwendbar (PC-Plattform)",
      gameLibrary: "30.000+ Spiele",
      launchPrice: "Kostenlos (Plattform)",
    },
    milestones: [
      { title: "Half-Life 2 (Steam-Pflicht)", year: 2004, description: "Erzwang Steam-Installation — unpopulaer, aber strategisch brillant" },
      { title: "Steam Sales", year: 2008, description: "Erste grosse Rabattaktionen veraenderten den digitalen Spielevertrieb fuer immer" },
      { title: "Steam Workshop", year: 2011, description: "Ermoeglichte Community-Mods direkt ueber die Plattform" },
      { title: "SteamOS / Steam Deck", year: 2022, description: "Valves Linux-basierter Handheld brachte die PC-Bibliothek in die Hosentasche" },
      { title: "Proton (Steam Play)", year: 2018, description: "Kompatibilitaetsschicht, die tausende Windows-Spiele unter Linux spielbar machte" },
    ],
  },
];

const historyMap = new Map<string, ConsoleHistoryEntry>();
for (const entry of CONSOLE_HISTORY) {
  historyMap.set(entry.platformId, entry);
}

export function getConsoleHistory(platformId: string): ConsoleHistoryEntry | undefined {
  return historyMap.get(platformId);
}

export function getAllConsoleHistory(): ConsoleHistoryEntry[] {
  return CONSOLE_HISTORY;
}
