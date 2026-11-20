# Architekt 7.11 — bez okapów

Osobny projekt `project/architekt-7-11-bez-okapow`, pierwsza publikacja r1 z 20 listopada 2026. Źródłem jest „architekt 7.11” r17 z publicznego Mikrusa, wersja serwera 15, kod `d53afaabfbb712f988647ae892930353847e9144`. Odczyt HTTPS był zgodny z kanonicznym projektem r17. Pełna kopia źródła to `source-architekt-7-11-r17.json`; pierwszą bazą migracji tej kopii jest `initial-r1.json`. Obie historie mogą dalej rozwijać się niezależnie.

## Zakres

Na obu skrzydłach domu wysięg zmniejszono z 0,60 do 0,00 m od zewnętrznego lica. Usunięto sześć pełnowysokich obudów (24 ścianki), ramy szczytowe oraz ich podbitki i boczne okładziny. Arkusze blachy i rąbki mają pionowe zakończenie na obu powierzchniach. Oś ściany pod przeszkleniem leży 0,225 m od lica. Okładzina szczytu dochodzi do lica, a szyby i osie dolnych otworów zachowują oryginalne położenie.

Zachowano identyfikatory wszystkich pozostałych elementów, wyposażenie, schody i ich warianty, wnętrza, okna, ogród, działkę, wiatę i budynek gospodarczy. Test porównuje cały zapis pierwszej publikacji z kopią źródłową po dopuszczeniu wyłącznie różnic okapów i tożsamości projektu.

## Geometria i projekt planu

| Skrzydło | Rozpiętość między licami | Kąty obu połaci | Linia okapu w modelu | Kalenica w modelu |
| --- | ---: | ---: | ---: | ---: |
| Przednie | 7,750 m | 40,0000° | 5,1000 m | 8,351511 m |
| Poprzeczne | 7,640 m | 40,4038° | 5,1000 m | 8,351511 m |

Po przeliczeniu połaci obie kalenice przecinają się w lokalnym punkcie (−1,190 m, −2,785 m). Kosz łączy początek skrzydła poprzecznego z głównym dachem. Sprawdzono trzy widoczne szczyty, pionowe cięcie wszystkich czterech połaci, szczeliny okienne i brak wewnętrznej połaci gospodarza w otwartej przestrzeni połączenia. Wysokości są rzędnymi modelu.

W projekcie MPZP dla 18.1.MU.1, §21 pkt 3 lit. f, s. 22–23, zakres głównych połaci wynosi 37–45°. Tekst przewiduje poziomy podział na linii okapów i cokołu. Wariant realizuje zadaną przez użytkownika krawędź w licu przez styk blachy i drewna. Dokument nie podaje wymaganego wysięgu w centymetrach. To sprawdzenie geometrii dachu. Zastosowanie całego planu, w tym zapisów o fakturze pokrycia, wymaga odrębnej oceny. [Tekst projektu](https://bip.malopolska.pl/api/files/4273429#page=22) · [Ogłoszenie gminy](https://zielonki.pl/kolejne-wylozenia-projektow-planow-miejscowych-sprawdz-terminy-i-zglos-uwagi/)

## Dane użytkownika

Przed wydaniem zachowano rzeczywiste zapisy z Chrome Default, Chrome Profile 1 i przeglądarki aplikacji Codex dla dostępnych originów localhost, 127.0.0.1 oraz HTTP i HTTPS Mikrusa w ignorowanym katalogu głównego checkoutu `tmp/bez-okapow-20261120/profile{0,1,2}`. W żadnym z nich nie znaleziono zapisu projektu 7.11. Sześć odczytanych projektów serwera zapisano osobno. Lokalny plik roboczy r21 ze zmianami wnętrza nie jest częścią opublikowanego źródła r17.
