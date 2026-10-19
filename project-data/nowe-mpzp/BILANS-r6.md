# Bilans „nowe mpzp” r6 — wiata połączona z domem

Aktualna korekta z 19.10.2026 zastępuje nieopublikowaną propozycję r5. **Wiata przylega do domu**, zgodnie z jednoznaczną korektą użytkownika. Trzy wskaźniki powierzchniowe mieszczą się w limitach wyłożonego projektu MPZP; nie oznacza to pełnej zgodności budowlanej.

## Organizacja dojazdu i wymiary

- Jeden wjazd, jeden pas 3,50 m **pod wiatą przy domu**, dalej wspólny plac i brama garażu kampera. Nie ma osobnego pasa obok wiaty ani przejazdu wzdłuż granicy.
- Wiata **6,60 × 6,40 m = 42,24 m²**, dokładnie dwa miejsca. Szersze miejsce przy domu jest przejazdowe; **przed przejazdem kampera trzeba je zwolnić**. Nie dodano trzeciego stanowiska. Światło między bocznymi słupami 6,12 m: 2,56 m i 3,56 m na stanowiska, z pasem przejazdu 3,50 m w szerszym stanowisku.
- Krawędź dachu/płyty styka się z elewacją domu, bez przerwy w rzucie. Wiata pozostaje przesunięta o 4,50 m w stronę wjazdu; od tyłu wiaty do frontu garażu jest około 7,76 m w osi modelu. Nie jest to symulacja manewrów.
- Podniesiono dach wiaty: modelowa baza 4,05 m, górna krawędź 4,29 m, dolna krawędź attyki 3,99 m. Posadzka 0,45 m daje minimalny modelowany prześwit **3,54 m**. Kamper referencyjny ma 3,10 m wysokości; zapas nie uwzględnia nieznanych urządzeń na dachu, ugięć i projektu konstrukcji.
- Garaż bez zmian: **5,10 × 13,20 m = 67,32 m² zabudowy**, 55,35 m² w świetle pomieszczeń, w tym stanowisko 40,50 m² i warsztat 14,85 m². Brama 3,50 × 3,50 m. Bez tylnego okna, równolegle do domu, geometrycznie po 3 m od obu sąsiednich granic; nie jest to potwierdzenie ochrony pożarowej ani pomiar geodezyjny.
- Jedna połączona strefa dojazdu 142,57 m², częściowo pod wiatą; w bilansie nakładki nie są liczone dwukrotnie. Zachowano małe dojścia piesze, drzewa i wyposażenie terenu; usunięte wcześniejsze dodatkowe pasy nie wracają.

## Bilans części MU

Obszar kontroli **888,81 m²** roboczej części 18.1.MU.1 trzech działek 54/3, 55/3, 58/3; bez doliczania terenu rolnego. Obliczenia jako suma i różnica wielokątów. Podwyższone grządki i kosze nie są zaliczone do PBC; cała wiata wliczona do zabudowy. Zieleń wymaga naturalnego urządzenia zapewniającego wegetację i retencję.

| Parametr | r6 | Projekt MPZP §21 |
|---|---:|---:|
| PBC | **524,54 m² / 59,02%** | min. 50%; zapas **80,14 m²** |
| Zabudowa z całą wiatą | **230,12 m² / 25,89%** | maks. 40% |
| Nadziemna intensywność | **do 0,395** | 0,01–0,8 |
| Utwardzenia i wyłączone elementy poza zabudową | 134,14 m² | — |

Zabudowa: dom 120,56 m², wiata 42,24 m², garaż 67,32 m². Intensywność to ostrożne górne oszacowanie 350,68 m² kondygnacji, z całą wiatą i bez odejmowania pustek w domu. Dane: [balance-r6.json](balance-r6.json). Granica MU/R3 pochodzi z interpretacji rysunku wyłożenia, nie z zatwierdzonego podziału ani wytyczenia.

## Ograniczenia wymagające rozwiązania

**Aktualne miejsca pod wiatą są za blisko okien pomieszczeń mieszkalnych względem reguły §19 WT.** Dla stanowisk 2,50 × 5,00 m wycentrowanych na modelach aut najkrótsza odległość do okna pokoju dzieci wynosi około **3,42 m**, wobec 7 m dla małych parkingów osobowych, w tym zadaszonych. Wyjątek jednego/dwóch miejsc przy domu jednorodzinnym dotyczy miejsc niezadaszonych. Połączenie wiaty z domem nie zostało potraktowane jako automatyczne zwolnienie. Zachowano żądany układ jako koncepcję; potrzebna korekta lub formalne rozwiązanie przed realizacją. Odległość modelowanych stanowisk do bocznej granicy wynosi około 5,99 m. Dowód: `tmp/nowe-mpzp-r6-20261019/parking-window-distances.json`.

Nie rozstrzygnięto dopuszczalności płaskiego dachu wiaty, blachy na rąbek, linii zabudowy i pasów drogowych, wysokości liczonych od docelowego terenu, ochrony pożarowej drewnianych elewacji, konstrukcji podniesionej wiaty i jej połączenia z domem, oświetlenia/wentylacji warsztatu bez okna oraz hałasu i odciągu pyłu. Przyjęto prywatny warsztat hobbystyczny. Dwa stanowiska wiaty i jedno w garażu dają geometrycznie trzy miejsca, ale kwalifikacja kampera wymaga sprawdzenia. Rzeczywistych torów jazdy nie symulowano.

Po zmianie obrysu i wysokości wiaty przeliczono główne dachy z geometrii: dom 38,8097094818° / 39,2352369450°, symetryczne, wspólna kalenica 8,0856938754 m; garaż 37°, kalenica 5,7585297202 m. Węzeł rear-min/valley domu pozostaje rozpoznany, wewnętrzny szczyt pominięty. Wysokości modelowe nie są wysokościami prawnymi od docelowego terenu.

**Plan jest wyłożony, nie obowiązujący.** Źródła: [projekt MPZP §7, §11, §16, §21](https://bip.malopolska.pl/api/files/4273429), [rysunek](https://bip.malopolska.pl/api/files/4273326), [definicje wskaźników — ustawa planistyczna](https://api.sejm.gov.pl/eli/acts/DU/2026/538/text/U/D20260538Lj.pdf), [WT §12, §19, §271–276](https://eli.gov.pl/api/acts/DU/2022/1225/text.html). Stosowanie dotychczasowych WT wymaga uwzględnienia 18-miesięcznego okresu przejściowego i warunków [ustawy Dz.U. 2026/1161](https://eli.gov.pl/eli/DU/2026/1161/ogl), opisanych w historycznym bilansie r3. Nie złożono oświadczeń ani wniosków w imieniu użytkownika.
