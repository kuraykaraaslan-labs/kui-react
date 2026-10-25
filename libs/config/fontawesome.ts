// Font Awesome's stylesheet is imported into Tailwind's base layer (app/globals.css),
// so size utilities on an icon (`w-3 h-3`) win. Its default runtime <style> is
// unlayered and would beat every utility, so it is switched off here. Import this
// module once from the root layout and the root client component.
import { config } from '@fortawesome/fontawesome-svg-core';

config.autoAddCss = false;
