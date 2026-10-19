# nowe mpzp — niezależny podprojekt architekt

Projekt z 19.10.2026: `project/nowe-mpzp`, obecnie **r5**, z garażem równoległym do domu, bez tylnego okna, po 3 m od obu granic, wiatą na dwa auta oraz jednym pasem 3,50 m przy domu. **PBC części MU wynosi 55,54%**, zabudowa z wiatą 25,17%, intensywność do 0,387 — szczegóły i nadal nierozstrzygnięte ograniczenia: [BILANS-r5.md](BILANS-r5.md). Karta jest umieszczona po `architekt`. Dane kanoniczne: `project.json`; niezmienna baza migracji: `initial-r1.json`. Poprzednie r1, r2, r3 i r4 są zachowane w snapshotach `before-rotation-r1.json`, `before-boundary-alignment-r2.json`, `before-shared-access-r3.json`, `before-house-lane-r4.json`. `source-architekt-r7.json` zachowuje całą wersję źródłową. Kolejne zmiany należy kontynuować pod tym samym ref.

## Źródła i zachowanie danych

Użytkownik zamówił nowy wariant według wyłożenia MPZP oraz garaż dla kampera ze stolarnią w miejscu czerwonego oznaczenia na zdjęciu. Bazą jest poprawiony `architekt` r7. Wiata pochodzi z `Główny`, `project/zielonki-rear-bath-room` r80. Oba projekty źródłowe pozostają niezależne i niezmienione. Interpretacja i urzędowe źródła planu: [MPZP-DRAFT-2026-10-19.md](../../knowledge-bank/zielonki/MPZP-DRAFT-2026-10-19.md).

Przed edycją wykonano odzyskiwalne kopie rzeczywistych profili Chrome Default i Codex IAB (`codex-browser-app`), wraz z IndexedDB, historią, propozycjami i bazami publikacji: ignorowane `tmp/nowe-mpzp-20261019/{chrome-before,iab-before}/`. Sprawdzono originy HTTP/HTTPS Mikrus oraz lokalne 127.0.0.1/localhost. Scalanie architekta według ref i baz opublikowanych nie ujawniło niezależnych zmian treści: lokalne r10, HTTPS r8 i starsze Chrome r5 zbiegają do kanonicznego r7. Shared architekt: serverVersion 3, projekt r8; shared Główny: serverVersion 6, r80. Wyższy numer nie był kryterium wyboru.

Stary origin IAB `http://localhost:5173` zawiera niezależne zmiany mebli Głównego r30. Pozostają w swoim originie i surowej kopii; nie nadpisano ich ani nie użyto jako źródła nowego wariantu. Nie ma dostępu do profilu Safari z telefonu: nie twierdzimy, że jego lokalne dane zostały przechwycone. Nowa publikacja dodaje osobny projekt bez nadpisywania starszych projektów.

Ponowny zapis rzeczywistych profili przed publikacją: `{chrome-predeploy,iab-predeploy}`. Chrome pozostał identyczny. W IAB pojawiły się w międzyczasie niezależne poprawki architekta r11/base r8 oraz lokalny pierwszy zapis nowe-mpzp r1. Zachowano je i pełne historie. Powstający równolegle architekt r8 nie jest częścią tego wydania: wariant nowe-mpzp nadal ma jawne źródło r7. Różnice zapisano w `predeploy-browser-changes.json`; release jest budowany z osobnego, czystego checkoutu własnego commitu, aby nie opublikować cudzych niezakończonych zmian.

## Historyczny układ r2

- Granice ewidencyjne zachowane. Odtworzona z PDF granica `18.1.MU.1 / 18.R3.1` daje roboczo 888,81 m² części budowlanej.
- Dom przesunięty w osi modelu z o **+4,3284132811 m**, czyli w prawo na fotografii, w stronę ogrodu. Położenie: `x=-7.44966521297, z=1.65055679940`. Wnętrza i geometria domu pozostają identyczne z architekt r7. Skrajny pełny obrys okapu zachowuje **0,75 m prostopadłego bufora** do roboczej linii przeznaczenia. Ten bufor nie jest odległością ustawową ani dowodem zgodności z liniami zabudowy.
- Tylna wiata na dwa samochody skopiowana z Głównego, z tym samym położeniem względem domu, konstrukcją i wyposażeniem. Jej płaski dach pozostaje osobnym zagadnieniem planistycznym.
- Garaż w czerwono zaznaczonej części frontowej: obrys zewnętrzny **5,10 × 13,20 m**, położenie `x=8,z=-9`, **obrót 90°**. Długi bok biegnie wzdłuż czerwonego oznaczenia, brama jest skierowana ku domowi/podjazdowi. Czarne drewno i dach w stylu domu. Zastępuje wcześniejszy odległy garaż/SPA wyłącznie w tym wariancie, zachowując `building/garden-outbuilding`.
- Światło stanowiska **4,50 × 9,00 m**, bramy **3,50 × 3,50 m**, wysokość pod okapem od posadzki **3,75 m**. Kamper referencyjny **7,40 × 2,35 × 3,10 m**. Użytkownik nie podał rzeczywistych gabarytów, także klimatyzacji/anten; sprawdzić przed projektem wykonawczym.
- Warsztat z tyłu garażu: **4,50 × 3,30 m = 14,85 m²**, wejście wewnętrzne i zewnętrzne, okno, stół roboczy, szafa narzędziowa oraz regał na drewno. Brama jest reprezentowana dostępnym otworem drzwiowym; mechanizm bramy segmentowej, nadproże, odciąg pyłu, instalacje i izolacja akustyczna nie są projektem wykonawczym.
- Przesunięte powierzchnie dojścia i dojazdu, dodany podjazd kampera i dostęp do wiaty. Po obrocie garażu plac przed bramą dopasowano do nowego kierunku; manewrowanie między garażem, wiatą i drogą nie jest zweryfikowane symulacją toru rzeczywistego pojazdu. Ze względu na kolizję pnia z nową bryłą wyłączono z tego wariantu `plant/survey-5015`; oryginał zachowuje snapshot źródła. To propozycja zagospodarowania, nie zgoda na wycinkę. Pozostałe drzewa zachowane.

## Dachy i sprawdzenia

Po przesunięciu i dodaniu garażu przeliczono kąty z geometrii: `ridge = eaves + tan(pitch) * perpendicularSpan/2`.

| Bryła | Rozpiętość prostopadła | Okap w modelu | Kąt obu połaci | Kalenica w modelu |
| --- | ---: | ---: | ---: | ---: |
| Dom, front-barn | 7,30 m | 5,15 m | 38,8097094818° | 8,0856938754 m |
| Dom, rear-barn | 7,19 m | 5,15 m | 39,2352369450° | 8,0856938754 m |
| Garaż | 4,80 m | 3,95 m | 37° | 5,7585297202 m |

Połacie są symetryczne i w przedziale 37–45°. Dom ma wspólną wysokość kalenic. Przecięcie prostopadłych kalenic pozostaje `(-1.19,-2.985)` w lokalnym układzie domu; połączenie rear-min/valley jest rozpoznawane, wewnętrzny szczyt pomijany. Geometria i wnętrza źródłowego domu nie zmieniły się. Sprawdzono widoki zewnętrzne, przekrój i rzut garażu; dachy nie wychodzą poza roboczy teren budowlany. Garaż jest o około 2,33 m niższy od domu w tym samym układzie modelu. Wysokości nie są pomiarem nad docelowym terenem.

Walidacja schematu/geometrii bez błędów; brak ostrzeżeń strefowych i dotyczących wyposażenia nowego garażu. Zachowane stare ostrzeżenia wnętrz domu i geotechniczne nie są usuwane. 577 testów, TypeScript i build przechodzą. Testy obejmują dodanie nowego projektu, brak zmian rodzica, ponowne otwarcie, zachowanie nowego MPZP, niezależnych nazw i usunięcia drzewa po scaleniu oraz brak odtworzenia usuniętego projektu. Widoki i testy przeglądarkowe są zapisywane w ignorowanym katalogu tej publikacji.

Przed realizacją architekt powinien sprawdzić ostateczny/uchwalony plan, pełne wskaźniki terenu inwestycji, linie zabudowy i odległości, wjazd i manewrowanie rzeczywistym kamperem, bezpieczeństwo pożarowe, hałas warsztatu, konstrukcję oraz rzeczywiste rzędne wysokościowe. Ta koncepcja nie potwierdza pełnej zgodności budowlanej.

## Historyczna aktualizacja r3 — bilans i ustawienie równoległe

Na prośbę użytkownika z 19.10.2026: pozycja garażu `x=7.80673645339404,z=-9.863734400993879`, obrót `93.06927082481445°`, dokładnie równoległy do domu (różnica 180°). Dystans zewnętrznego obrysu do sąsiedniej granicy przy pełnej ścianie wynosi 3 m, przy tylnej ścianie z oknem 4 m. Poprzedni r2 miał przy tej ścianie tylko 3,779 m. Zmieniono krótki odcinek placu łączący bramę; zachowano resztę utwardzeń, wszystkie wymiary, wnętrza, drzewa i otwory. Wariant 1,5 m lub przy granicy wymaga dodatkowych rozwiązań opisanych w bilansie.

Przeliczono dachy z finalnej geometrii: dom 38,8097094818° / 39,2352369450°, kalenice 8,0856938754; garaż 37°, kalenica 5,7585297202. Transformacja pozioma nie zmienia rozpiętości ani wysokości. Węzeł dachu domu i wnętrza nie zmieniły się. Bilans sumy wielokątów: zabudowa z wiatą 220,77 m² (24,84%), intensywność do 0,384; PBC ostrożnie 420,74 m² (47,34%), niedobór 23,66 m². Nie oznaczono nierozstrzygniętych wymogów jako spełnionych. Wyniki dodano do ostrzeżeń projektu.

Przed tą zmianą ponownie przechwycono rzeczywiste profile Chrome i Codex IAB do `tmp/nowe-mpzp-balance-20261019/{chrome-before,iab-before}/`. Publiczne profile nie zawierają niezależnych zapisów tego nowego wariantu. Lokalny IAB `127.0.0.1:5173` ma r1/base r1 z niezależnie zmienioną listą ostrzeżeń: konflikt `/site/knowledgeBase/caveats` zachowano w odzyskiwalnej kopii i nie nadpisano tego originu. Wspólny projekt Mikrus przed zmianą: serverVersion 1, r2, zgodny z zachowanym snapshotem. Publikacja dotyczy niezależnego nowe-mpzp; równoległe lokalne poprawki architekta pozostają poza wydaniem.

## Historyczna aktualizacja r4 — usunięcie okna i dodatkowych przejazdów

Użytkownik przekreślił tylne okno oraz dodatkowe pasy dojazdowe, a następnie jawnie potwierdził jeden wspólny dojazd dla wiaty i kampera. Usunięto otwór tylnej ściany i dosunięto garaż do 3 m od obu granic: `x=8.806556329634887,z=-9.888200332287484`, obrót nadal `93.06927082481445°`. Wiata poszerzona do 5,60 × 6,40 m, dwa auta i 5,12 m pomiędzy wewnętrznymi krawędziami słupów. Jedna połączona strefa dojazdu zastępuje wcześniejsze osobne pasy; usunięcia są rzeczywistymi usunięciami encji, nie ukryciem ani zmianą nazwy. Bilans odzyskuje 97,51 m² zieleni; PBC 518,25 m², zapas do 50% wynosi 73,85 m². Warsztat po usunięciu okna wymaga sprawdzenia oświetlenia i wentylacji.

Ponownie przeliczono dachy po zmianie obrysu płaskiej wiaty: główne połacie domu 38,8097094818° i 39,2352369450°, wspólna kalenica 8,0856938754; garaż 37°, kalenica 5,7585297202. Dach i połączenie domu, wysokości, wnętrza oraz reszta otworów są zachowane. Widoki zewnętrzne, rzuty i przekroje sprawdzane z aktualnej geometrii. Test migracji z r3 obejmuje nowe położenie, usunięte okno i strefy, zachowanie niezależnego usunięcia drzewa oraz niezmienność rodzica.

Kopie rzeczywistych Chrome/IAB sprzed r4: `tmp/nowe-mpzp-r4-20261019/{chrome-before,iab-before}/`. Lokalny konflikt caveats r1 nadal zachowano i nie nadpisano originu. Publiczny kod r3 (`242393f`) został opublikowany przed nadejściem doprecyzowania; shared pozostał wtedy serverVersion 1/r2. R4 kontynuuje tę samą tożsamość, z warunkową aktualizacją shared po ponownym sprawdzeniu wersji i treści. Poprzednie publikacje i historie zachowane. Pełne wyniki, metoda i źródła: [BILANS-r4.md](BILANS-r4.md).

## Aktualizacja r5 — jedyny pas przy domu

Po ostatnim doprecyzowaniu użytkownika główny pas 3,50 m biegnie przy domu, pomiędzy domem a dwustanowiskową wiatą, i prowadzi do wspólnego placu przed garażem kampera. Wiata została odsunięta od domu o 3,70 m i przesunięta o 4,50 m w stronę wjazdu; światło przed garażem wynosi około 7,76 m w osi modelu. Dach wiaty jest za niski dla kampera 3,10 m, dlatego kamper przejeżdża obok niej. Jedyny wielokąt dojazdu ma 157,21 m²; brak zewnętrznego pasa przy granicy. Garaż, brak tylnego okna, oba odstępy 3 m i równoległość pozostają bez zmian. Poprzedni r4 jest zachowany w before-house-lane-r4.json.

Bilans r5: PBC 493,62 m² / 55,54%, zapas 49,21 m²; zabudowa 223,72 m² / 25,17%; intensywność do 0,387. Pomiar dwóch stanowisk 2,50 × 5,00 m wykazał około 5,91 m do okna pokoju dzieci wobec 7 m wymaganego przez §19 WT dla zadaszonych miejsc. Tego wymogu nie oznaczono jako spełnionego; szczegóły, przepisy przejściowe i pozostałe ograniczenia w BILANS-r5.md. Główne dachy i węzeł domu bez zmian: 38,8097094818° / 39,2352369450°, kalenice 8,0856938754; garaż 37°, kalenica 5,7585297202. Zmiana położenia płaskiej wiaty nie zmienia jej wysokości ani połaci.

Przed publikacją wykonano nowe odzyskiwalne kopie rzeczywistych Chrome Default i Codex IAB w tmp/nowe-mpzp-r5-20261019. Zachowano lokalny konflikt caveats r1 i nie nadpisano tego originu. Publiczny architekt r8 został w międzyczasie niezależnie opublikowany jako a4eace6 i pozostaje zachowany w następnym wydaniu; niezależny nowe-mpzp nadal korzysta ze źródła architekt r7. Warunkowa aktualizacja shared dotyczy wyłącznie nowe-mpzp, z zachowaniem propozycji i historii.
