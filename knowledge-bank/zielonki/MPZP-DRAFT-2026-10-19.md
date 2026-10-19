# Zielonki: wyłożenie 19.10–10.11.2026

Sprawdzone 19 października 2026. **To projekt wyłożony do publicznego wglądu, nie plan obowiązujący.** Osobny wariant `project/nowe-mpzp` pokazuje jego przypuszczalny wpływ na działki 54/3, 55/3 i 58/3. Ustalenia dotychczasowego planu i źródła prawne pozostają w [ZONING.md](ZONING.md).

## Źródła urzędowe

- [Ogłoszenie Wójta z 27.08.2026](https://zielonki.pl/ogloszenie-wojta-gminy-zielonki-z-dnia-27-sierpnia-2026-r-o-wylozeniu-do-publicznego-wgladu-projektow-miejscowych-planow-zagospodarowania-przestrzennego-miejscowosci-brzozowka-grebynice-korzkiew/): wyłożenie Zielonek 19.10–10.11.2026.
- [BIP: Zielonki](https://bip.malopolska.pl/gzielonki,m,478626,zielonki.html), artykuł 2953815, wersja 2.
- [Rysunek planu, załącznik nr 1, 10.26](https://bip.malopolska.pl/api/files/4273326), plik 40 736 558 B, SHA256 `9375399b373f910a91ce5555f65a2f86950ccd2232bfdd9e0910e04dee0f36c6`.
- [Projekt uchwały, 34 strony](https://bip.malopolska.pl/api/files/4273429), plik 535 651 B, SHA256 `ca95eb3bd7c65ea0de4bd773853f5e7b728bd3b9f86b4135e4ce3ddc00547243`.

Surowe pliki, odczyt BIP, ekstrakcja tekstu i obrazy kontrolne: ignorowany katalog `tmp/nowe-mpzp-20261019/`. Numery plików i sumy pozwalają rozpoznać tę wersję dokumentów po kolejnych zmianach BIP.

## Odczyt dla lokalizacji

Rysunek wskazuje **18.1.MU.1** i po stronie pól **18.R3.1**. §21 projektu (drukowane strony 22–23) dotyczy terenów mieszkaniowo-usługowych w Parku Krajobrazowym Dolinki Krakowskie. Przewiduje m.in. wysokość domu do 9 m, garaży i budynków gospodarczych do 6 m, dachy symetryczne o głównych połaciach 37–45° z kalenicą równoległą do dłuższego boku, maksymalny udział zabudowy 40%, minimalny udział biologicznie czynny 50% i nadziemną intensywność 0,01–0,8. Pełne przepisy, definicje i pozostałe ograniczenia trzeba rozpatrywać łącznie.

Utrzymana czarna okładzina i geometria garażu odpowiadają wizualnie domowi. Nie przesądza to zgodności pokrycia: projekt wymienia dachówkę lub materiały o podobnej drobnej fakturze. Również płaska wiata skopiowana z Głównego wymaga osobnej oceny. Poziomy w modelu nie są automatycznie wysokościami mierzonymi według definicji planu lub przepisów budowlanych.

## Odtworzenie granicy

Nie zmieniono granic ewidencyjnych ani powierzchni własności. Zmieniono wyłącznie podział przeznaczenia działek w niezależnej koncepcji. Użyto wektorowej krawędzi wypełnienia MU/R3 i drukowanej siatki PL-2000 w PDF, a nie proporcji fotografii ekranu.

- PDF (punkty, początek w lewym górnym rogu): `(1271.27783203125, 531.4970703125)` odpowiada `E=7421600, N=5556000`.
- Skala z sąsiednich linii siatki 100 m: `2.8343902587890626 pkt/m` w poziomie, `2.83453125 pkt/m` w pionie. Północ ma przeciwny znak do osi y PDF.
- Lokalny początek modelu: `E=7421523.183, N=5556062.474`; transformacja osi z [orientation.ts](orientation.ts).
- Odcinek graniczny w PDF: `(998.6422729492188,328.0078125)` – `(1376.6422119140625,723.5205078125)`; ścieżka wypełnienia 299, element 6 w odczycie PyMuPDF tej wersji pliku.
- Po transformacji: `z = -0.18279848635434473*x + 7.692912267376711`.
- Odcinek przecinający własność: `(-18.4030984624,11.0569708105)` – `(19.0114577657,4.2176465644)`.

Nałożenie dotychczasowych granic geodezyjnych modelu na podkład PDF potwierdza dopasowanie lokalizacji. Podział zachowuje sumę pól każdego wielokąta; przypuszczalna część budowlana wynosi **888,81 m²**, około **190,29 m² więcej** niż w dotychczasowym modelu. Jest to wynik roboczy z rysunku, nie geodezyjne wyznaczenie linii. Dalsze działki `/4` pozostają rolne.

Implementacja: [draftPlan.ts](draftPlan.ts); źródła i decyzje projektowe: [README wariantu](../../project-data/nowe-mpzp/README.md). Znacznik wersji wiedzy chroni ten wariant i jego kopie przed automatycznym przywróceniem starej mapy przy odczycie IndexedDB.
