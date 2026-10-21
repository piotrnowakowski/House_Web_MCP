# Bilans „nowe mpzp” r4 — 19.10.2026

**Po korekcie potwierdzonej przez użytkownika trzy sprawdzone wskaźniki powierzchniowe mieszczą się w limitach projektu MPZP.** Nie oznacza to jeszcze pełnej zgodności budowlanej. Poprzedni bilans z niedoborem zieleni opisuje wyłącznie historyczny [r3](BILANS-r3.md).

## Zmiana układu

- Usunięto okno `opening/outbuilding/workshop-window` z tylnej ściany garażu. Nie dodano innego otworu w tej ścianie.
- Garaż pozostaje równoległy do domu: 93,0692708248° wobec 273,0692708248°. Nowy środek: `x=8.806556329634887,z=-9.888200332287484`. Najkrótsze odległości zewnętrznego obrysu do obu sąsiednich granic wynoszą **3,00 m**. Względem r3 przesunięto go o około 1 m ku górnej granicy rysunku. To minimum przyjęte geometrycznie, przed sprawdzeniem geodezyjnym, tolerancjami wykonania i oceną pożarową.
- Garaż ma nadal **5,10 × 13,20 m = 67,32 m²** zabudowy. W świetle pomieszczeń 55,35 m²: stanowisko kampera 40,50 m² i warsztat 14,85 m². Wysokości i wyposażenie nie zmieniły się.
- Wiata została nieznacznie poszerzona od strony dojazdu do **5,60 × 6,40 m = 35,84 m²**. Są dokładnie dwa samochody obok siebie, bez trzeciego stanowiska ani przejazdu przez wiatę. Między wewnętrznymi krawędziami bocznych słupów pozostaje **5,12 m**, co pozwala wydzielić dwa pasy po 2,56 m; modele aut mają po 1,90 × 4,70 m. Słupy i auta dostosowano do nowego obrysu. Zewnętrzna krawędź przy domu pozostaje na miejscu.
- Zgodnie z odpowiedzią użytkownika pozostawiono **jeden wspólny dojazd** od istniejącego wjazdu do dwóch stanowisk wiaty i bramy kampera. Główny pas ma 4 m szerokości, z poszerzeniem przy wjeździe, placem przed wiatą i dojściem do bramy. Nie ma dodatkowego obwodowego pasa przy granicy ani przejazdu przez wiatę.
- Usunięto strefy `zone/path`, `zone/nowe-mpzp/carport-access`, `zone/outbuilding/apron`. Zastępuje je jedna połączona strefa `zone/driveway` o powierzchni 133,62 m². Zachowano małe dojścia piesze; wcześniejszy plac przed wejściem zastąpiono dojściem 1,50 m². Kosze pozostały w swoim położeniu i są osobno uwzględnione jako powierzchnia niezaliczona do zieleni.

## Bilans

Obszar kontroli: **888,81 m² roboczej części 18.1.MU.1** działek 54/3, 55/3 i 58/3. Nie doliczono powierzchni rolnej. Metoda jak w r3: suma i różnica wielokątów, bez podwójnego liczenia nakładek; podwyższonych grządek nie zaliczono do PBC, całą wiatę uwzględniono w zabudowie. Powierzchnie odzyskane po usunięciu utwardzeń mają być urządzone jako naturalna zieleń umożliwiająca wegetację i retencję.

| Parametr | r4 | Projekt MPZP §21 | Wynik |
|---|---:|---:|---|
| Powierzchnia biologicznie czynna | **518,25 m² / 58,31%** | min. 50% / 444,40 m² | Spełnione w modelu; zapas **73,85 m²** |
| Zabudowa razem z całą wiatą | **223,72 m² / 25,17%** | maks. 40% | Spełnione w modelu |
| Nadziemna intensywność | **do 0,387** | 0,01–0,8 | Spełnione w modelu |
| Utwardzenia i niezaliczone elementy poza zabudową | 146,83 m² | — | Suma bez nakładek |

Zabudowa: dom 120,56 m², wiata 35,84 m², garaż 67,32 m². Górne oszacowanie powierzchni kondygnacji do intensywności: 344,28 m², obejmuje obie kondygnacje domu, garaż i dodatkowo całą wiatę, bez odejmowania pustek salonu i schodów. Dane liczbowe: [balance-r4.json](balance-r4.json). Skrypt kontrolny: `tmp/nowe-mpzp-r4-20261019/balance.mjs`; sprawdza domknięcie bilansu i wszystkie trzy progi.

W porównaniu z r3 zieleń wzrosła o **97,51 m²**, mimo poszerzenia wiaty. Nie oparto poprawy na samym oznaczeniu nawierzchni jako przepuszczalnej: dodatkowe utwardzenia rzeczywiście usunięto z modelu.

## Dachy i nierozstrzygnięte wymagania

Po zmianie obrysu wiaty i położenia garażu ponownie sprawdzono finalną geometrię. Dachy główne domu: 38,8097094818° i 39,2352369450°, symetryczne, wspólna modelowa kalenica 8,0856938754 m, rozpoznawany węzeł valley bez wewnętrznego szczytu. Garaż: rozpiętość 4,80 m, okap 3,95 m, obie połacie 37°, kalenica 5,7585297202 m. Wiata pozostaje płaska na poziomie modelowym 2,95 m, z attyką 0,30 m; jej poszerzenie nie zmieniło geometrii dachów domu.

Nadal wymagają rozstrzygnięcia: dopuszczalność płaskiego dachu wiaty i pokrycia z blachy na rąbek, wysokość od docelowych rzędnych terenu, linie zabudowy i pasy drogowe, ochrona pożarowa i drewniane elewacje, hałas/odciąg pyłu oraz **oświetlenie i wentylacja warsztatu po usunięciu okna**. Przyjęto prywatny warsztat hobbystyczny. Trzy miejsca parkingowe są zapewnione geometrycznie (dwa pod wiatą i jedno w garażu), lecz kwalifikacja kampera i rzeczywisty tor jazdy wymagają sprawdzenia. Nie wykonano symulacji manewrów konkretnego kampera ani projektu konstrukcyjnego.

**Plan jest wyłożony, nie obowiązujący.** Dotychczasowy plan ma inną granicę zabudowy. Powyższe wyniki odnoszą się do scenariusza nowego wyłożenia i nie stanowią potwierdzenia możliwości uzyskania pozwolenia.

Źródła: [projekt MPZP — §7, §11, §16, §21](https://bip.malopolska.pl/api/files/4273429), [rysunek](https://bip.malopolska.pl/api/files/4273326), [ustawa planistyczna art. 2 pkt 28–35](https://api.sejm.gov.pl/eli/acts/DU/2026/538/text/U/D20260538Lj.pdf), [WT §12 i §271–276](https://eli.gov.pl/api/acts/DU/2022/1225/text.html). Stosowanie dawnych WT wymaga uwzględnienia przepisów epizodycznych z [ustawy Dz.U. 2026/1161](https://eli.gov.pl/eli/DU/2026/1161/ogl); pełniejsze wyjaśnienie i źródła pozostają w raporcie r3. Nie złożono w imieniu użytkownika żadnego oświadczenia ani wniosku.
