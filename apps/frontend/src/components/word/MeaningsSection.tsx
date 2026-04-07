import { Badge } from "@/components/ui";
import type { Meaning } from "@/types";

interface MeaningsSectionProps {
  meanings: Meaning[];
  onLookupWord?: (word: string) => void;
}

export function MeaningsSection({
  meanings,
  onLookupWord,
}: MeaningsSectionProps) {
  if (meanings.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No definitions available.</p>
    );
  }

  return (
    <div className="space-y-6">
      {meanings.map((meaning, mi) => (
        <div key={mi}>
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="pos">{meaning.part_of_speech}</Badge>
            <div className="flex-1 border-t border-gray-200 dark:border-gray-800" />
          </div>

          <ol className="space-y-3">
            {meaning.definitions.map((def, di) => (
              <li key={di} className="flex gap-3">
                <span className="mt-0.5 flex-shrink-0 text-xs font-bold text-gray-400 dark:text-gray-600">
                  {di + 1}.
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm leading-relaxed">{def.definition}</p>
                  {def.example && (
                    <p className="text-sm italic text-gray-500 dark:text-gray-400 border-l-2 border-brand-200 dark:border-brand-900 pl-3">
                      "{def.example}"
                    </p>
                  )}
                  {def.synonyms.length > 0 && (
                    <WordGroup
                      label="Synonyms"
                      words={def.synonyms}
                      onLookupWord={onLookupWord}
                    />
                  )}
                  {def.antonyms.length > 0 && (
                    <WordGroup
                      label="Antonyms"
                      words={def.antonyms}
                      onLookupWord={onLookupWord}
                    />
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

interface WordGroupProps {
  label: string;
  words: string[];
  onLookupWord?: (word: string) => void;
}

function WordGroup({ label, words, onLookupWord }: WordGroupProps) {
  return (
    <div className="flex flex-wrap items-start gap-1.5 pt-1">
      <span className="pt-1 text-xs font-medium text-gray-400">{label}:</span>
      {words.slice(0, 6).map((word) =>
        onLookupWord ? (
          <button
            key={word}
            type="button"
            onClick={() => onLookupWord(word)}
            className="rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 transition-colors hover:border-brand-300 hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300 dark:hover:border-brand-800 dark:hover:bg-brand-950/70"
          >
            {word}
          </button>
        ) : (
          <span
            key={word}
            className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
          >
            {word}
          </span>
        )
      )}
    </div>
  );
}
