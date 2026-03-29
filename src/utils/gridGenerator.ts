import { COMMON_WORDS, getBonusWords, isSubAnagram } from './dictionary';

export type Cell = {
  letter: string;
  x: number;
  y: number;
};

export type GridData = {
  cells: Cell[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  placedWords: { word: string; x: number; y: number; isHorizontal: boolean }[];
  wheelLetters: string[];
  dictionaryWords: string[];  // bonus words formable from wheel letters
  masterWord: string;         // primary source word for the wheel
};

const shuffle = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const getKey = (x: number, y: number) => `${x},${y}`;

const canPlace = (
  word: string,
  startX: number,
  startY: number,
  isHorizontal: boolean,
  gridMap: Map<string, string>,
  placedWords: { word: string; x: number; y: number; isHorizontal: boolean }[]
): boolean => {
  // No cell immediately before or after word (prevents extensions)
  if (isHorizontal) {
    if (gridMap.has(getKey(startX - 1, startY))) return false;
    if (gridMap.has(getKey(startX + word.length, startY))) return false;
  } else {
    if (gridMap.has(getKey(startX, startY - 1))) return false;
    if (gridMap.has(getKey(startX, startY + word.length))) return false;
  }

  let intersections = 0;
  for (let i = 0; i < word.length; i++) {
    const x = startX + (isHorizontal ? i : 0);
    const y = startY + (!isHorizontal ? i : 0);
    const cell = gridMap.get(getKey(x, y));

    if (cell && cell !== word[i]) return false;
    if (cell) {
      intersections++;
    } else {
      // No parallel neighbors
      const neighbors: [number, number][] = isHorizontal
        ? [[x, y - 1], [x, y + 1]]
        : [[x - 1, y], [x + 1, y]];
      for (const [nx, ny] of neighbors) {
        if (gridMap.has(getKey(nx, ny))) return false;
      }
    }
  }

  // Must intersect an existing word (after first word)
  if (placedWords.length > 0 && intersections === 0) return false;
  // Must not completely overlap
  if (intersections >= word.length) return false;

  return true;
};

const placeWord = (
  word: string,
  startX: number,
  startY: number,
  isHorizontal: boolean,
  gridMap: Map<string, string>,
  placedWords: { word: string; x: number; y: number; isHorizontal: boolean }[]
) => {
  for (let i = 0; i < word.length; i++) {
    const x = startX + (isHorizontal ? i : 0);
    const y = startY + (!isHorizontal ? i : 0);
    gridMap.set(getKey(x, y), word[i]);
  }
  placedWords.push({ word, x: startX, y: startY, isHorizontal });
};

export function generateGrid(): GridData | null {
  // 1. Pick a random Master Word (5-7 letters)
  const masterWords = COMMON_WORDS.filter(w => w.length >= 5 && w.length <= 7);
  if (masterWords.length === 0) return null;
  
  // Try multiple times to find a word set that builds a good grid
  for (let attempts = 0; attempts < 20; attempts++) {
    const masterWord = masterWords[Math.floor(Math.random() * masterWords.length)];
    const wheelLetters = shuffle(masterWord.split(''));

    // 2. Find all formable sub-anagrams
    const allFormable = COMMON_WORDS.filter(w => isSubAnagram(w, wheelLetters));
    
    // 3. Shuffle and pick words for the grid
    // Ensure the master word is included
    const otherWords = shuffle(allFormable.filter(w => w !== masterWord));
    // Ensure unique words only
  const wordsToTry = Array.from(new Set([masterWord, ...otherWords]));

    const placedWords: { word: string; x: number; y: number; isHorizontal: boolean }[] = [];
    const gridMap = new Map<string, string>();

    // Start with the longest word (often the master word)
    const firstWord = wordsToTry[0];
    placeWord(firstWord, 0, 0, true, gridMap, placedWords);

    // Try to place as many words as possible
    for (let wi = 1; wi < wordsToTry.length; wi++) {
      const word = wordsToTry[wi];
      const candidates: { x: number; y: number; isHorizontal: boolean }[] = [];

      for (let i = 0; i < word.length; i++) {
        for (const placed of placedWords) {
          for (let j = 0; j < placed.word.length; j++) {
            if (placed.word[j] === word[i]) {
              const px = placed.x + (placed.isHorizontal ? j : 0);
              const py = placed.y + (!placed.isHorizontal ? j : 0);
              const isHoriz = !placed.isHorizontal;
              const sx = px - (isHoriz ? i : 0);
              const sy = py - (!isHoriz ? i : 0);
              if (canPlace(word, sx, sy, isHoriz, gridMap, placedWords)) {
                candidates.push({ x: sx, y: sy, isHorizontal: isHoriz });
              }
            }
          }
        }
      }

      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(Math.random() * candidates.length)];
        placeWord(word, chosen.x, chosen.y, chosen.isHorizontal, gridMap, placedWords);
      }
      
      // Stop if we have enough words (avoid overly crowded grids)
      if (placedWords.length >= 8) break;
    }

    // If grid is decent size, return it
    if (placedWords.length >= 4) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      const cells: Cell[] = [];
      gridMap.forEach((letter, key) => {
        const [x, y] = key.split(',').map(Number);
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        cells.push({ letter, x, y });
      });

      const dictionaryWords = getBonusWords(wheelLetters);

      return {
        cells,
        minX, maxX, minY, maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        placedWords,
        wheelLetters,
        dictionaryWords,
        masterWord: masterWord
      };
    }
  }

  return null;
}

