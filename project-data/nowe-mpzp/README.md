# nowe mpzp — niezależny podprojekt architekt

Projekt z 19.10.2026: `project/nowe-mpzp`, obecnie **r2**, z obrotem garażu o 90° na dodatkową prośbę użytkownika. Karta jest umieszczona po `architekt` w głównej liście projektów. Dane kanoniczne: `project.json`; niezmienny punkt odniesienia przyszłych migracji: `initial-r1.json`. Pierwszy pokazany układ jest też zachowany jako `before-rotation-r1.json`. `source-architekt-r7.json` zachowuje całą wersję źródłową, także zastąpioną koncepcję zabudowy w polu. Kolejne zmiany należy kontynuować pod tym samym ref.

## Źródła i zachowanie danych

Użytkownik zamówił nowy wariant według wyłożenia MPZP oraz garaż dla kampera ze stolarnią w miejscu czerwonego oznaczenia na zdjęciu. Bazą jest poprawiony `architekt` r7. Wiata pochodzi z `Główny`, `project/zielonki-rear-bath-room` r80. Oba projekty źródłowe pozostają niezależne i niezmienione. Interpretacja i urzędowe źródła planu: [MPZP-DRAFT-2026-10-19.md](../../knowledge-bank/zielonki/MPZP-DRAFT-2026-10-19.md).

Przed edycją wykonano odzyskiwalne kopie rzeczywistych profili Chrome Default i Codex IAB (`codex-browser-app`), wraz z IndexedDB, historią, propozycjami i bazami publikacji: ignorowane `tmp/nowe-mpzp-20261019/{chrome-before,iab-before}/`. Sprawdzono originy HTTP/HTTPS Mikrus oraz lokalne 127.0.0.1/localhost. Scalanie architekta według ref i baz opublikowanych nie ujawniło niezależnych zmian treści: lokalne r10, HTTPS r8 i starsze Chrome r5 zbiegają do kanonicznego r7. Shared architekt: serverVersion 3, projekt r8; shared Główny: serverVersion 6, r80. Wyższy numer nie był kryterium wyboru.

Stary origin IAB `http://localhost:5173` zawiera niezależne zmiany mebli Głównego r30. Pozostają w swoim originie i surowej kopii; nie nadpisano ich ani nie użyto jako źródła nowego wariantu. Nie ma dostępu do profilu Safari z telefonu: nie twierdzimy, że jego lokalne dane zostały przechwycone. Nowa publikacja dodaje osobny projekt bez nadpisywania starszych projektów.

Ponowny zapis rzeczywistych profili przed publikacją: `{chrome-predeploy,iab-predeploy}`. Chrome pozostał identyczny. W IAB pojawiły się w międzyczasie niezależne poprawki architekta r11/base r8 oraz lokalny pierwszy zapis nowe-mpzp r1. Zachowano je i pełne historie. Powstający równolegle architekt r8 nie jest częścią tego wydania: wariant nowe-mpzp nadal ma jawne źródło r7. Różnice zapisano w `predeploy-browser-changes.json`; release jest budowany z osobnego, czystego checkoutu własnego commitu, aby nie opublikować cudzych niezakończonych zmian.

## Układ r2

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
