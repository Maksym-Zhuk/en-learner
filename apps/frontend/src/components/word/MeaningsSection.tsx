import { Badge } from "@/components/ui";
import type { Meaning } from "@/types";

interface MeaningsSectionProps {
  meanings: Meaning[];
}

export function MeaningsSection({ meanings }: MeaningsSectionProps) {
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
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs font-medium text-gray-400">syn:</span>
                      {def.synonyms.slice(0, 5).map((s) => (
                        <span
                          key={s}
                          className="text-xs text-brand-600 dark:text-brand-400 cursor-pointer hover:underline"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
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
