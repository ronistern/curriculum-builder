import { useI18n } from '../i18n/useI18n';
import { LANGUAGES, type Lang } from '../i18n/translations';

export function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <select
      className="lang-switcher"
      value={lang}
      aria-label={t('app.language')}
      title={t('app.language')}
      onChange={(e) => setLang(e.target.value as Lang)}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
