import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';
import type { DiffMode } from '../types';
import { btnSecondary, card, focusRing } from './ui';

const EMAIL = 'blog.cottage627@passinbox.com';

const a = `font-medium text-indigo-700 dark:text-indigo-400 underline underline-offset-2 hover:no-underline rounded ${focusRing}`;

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={a}>
      {children}
    </a>
  );
}
const Mail = () => (
  <a href={`mailto:${EMAIL}`} className={a}>
    {EMAIL}
  </a>
);

const ul = 'list-disc pl-6 space-y-1 marker:text-slate-400';

/** Texto legal. Se ofrece solo en español (idioma del responsable del tratamiento). */
const sections: { title: string; body: ReactNode }[] = [
  {
    title: 'Responsable del tratamiento',
    body: (
      <>
        <p>El responsable del tratamiento de los datos personales es:</p>
        <p>
          <strong>Aitor Sánchez Gutiérrez</strong>
          <br />
          Correo electrónico de contacto: <Mail />
          <br />
          Sitio web: <Ext href="https://aitorsanchez.pages.dev/contacto">https://aitorsanchez.pages.dev/contacto</Ext>
        </p>
      </>
    ),
  },
  {
    title: 'Datos que recogemos',
    body: (
      <>
        <p>
          Cuando visitas este sitio web, se recoge la siguiente información mediante el script de analítica privada
          alojado en Cloudflare Workers:
        </p>
        <ul className={ul}>
          <li>Dirección IP</li>
          <li>Navegador y sistema operativo (extraídos del User-Agent)</li>
          <li>URL de la página visitada</li>
          <li>Fecha y hora de la visita / última actividad</li>
          <li>
            Identificador de sesión generado a partir de un hash (SHA-256 de <code>app_id + IP + User-Agent</code>)
          </li>
        </ul>
        <p>
          No se recogen nombres, correos electrónicos, datos de formularios ni ninguna otra información identificativa
          directa, salvo que el usuario la facilite voluntariamente a través de formularios de contacto u otros medios.
        </p>
      </>
    ),
  },
  {
    title: 'Finalidad del tratamiento',
    body: (
      <>
        <p>Los datos se tratan exclusivamente con las siguientes finalidades:</p>
        <ul className={ul}>
          <li>
            Elaborar estadísticas de uso del sitio web (número de visitas, páginas más vistas, navegadores, sistemas
            operativos y países de origen).
          </li>
          <li>Detectar y prevenir abusos o usos indebidos.</li>
          <li>Mejorar el funcionamiento y la experiencia del sitio.</li>
        </ul>
        <p>No se utilizan con fines publicitarios ni se venden a terceros.</p>
      </>
    ),
  },
  {
    title: 'Base legal',
    body: (
      <>
        <p>
          El tratamiento se basa en el <strong>interés legítimo</strong> del responsable (artículo 6.1.f del RGPD) para
          conocer el uso de su sitio web y mejorar el servicio, siempre que no prevalezcan los derechos e intereses del
          interesado.
        </p>
        <p>
          Si en el futuro se implementara un banner de cookies o se solicitara consentimiento explícito, se indicará en
          esta política.
        </p>
      </>
    ),
  },
  {
    title: 'Conservación de los datos',
    body: (
      <p>
        Los datos de visitas se conservan durante el tiempo necesario para cumplir las finalidades descritas y, como
        máximo, <strong>24 meses</strong> desde la última actividad registrada. Transcurrido ese plazo se eliminan o se
        anonimizan de forma irreversible.
      </p>
    ),
  },
  {
    title: 'Destinatarios y encargados del tratamiento',
    body: (
      <>
        <p>
          Los datos se almacenan y procesan en la infraestructura de <strong>Cloudflare, Inc.</strong> (Workers y base
          de datos D1), que actúa como encargado del tratamiento.
        </p>
        <p>
          Cloudflare cuenta con las garantías adecuadas conforme al RGPD (incluidas Cláusulas Contractuales Tipo y
          medidas de seguridad técnicas y organizativas).
        </p>
        <p>No se ceden datos a otros terceros, salvo obligación legal.</p>
      </>
    ),
  },
  {
    title: 'Transferencias internacionales',
    body: (
      <p>
        Cloudflare tiene servidores en Estados Unidos y en otros países. Las transferencias se realizan con las
        garantías previstas en el RGPD (Cláusulas Contractuales Tipo de la Comisión Europea y demás medidas
        complementarias).
      </p>
    ),
  },
  {
    title: 'Derechos de los interesados',
    body: (
      <>
        <p>Puedes ejercer en cualquier momento los siguientes derechos:</p>
        <ul className={ul}>
          <li>Acceso</li>
          <li>Rectificación</li>
          <li>Supresión (“derecho al olvido”)</li>
          <li>Limitación del tratamiento</li>
          <li>Oposición</li>
          <li>Portabilidad</li>
        </ul>
        <p>
          Para ejercerlos, envía un correo a <Mail /> indicando el derecho que deseas ejercer y aportando la
          información necesaria para localizar tus datos (por ejemplo, la dirección IP o el periodo aproximado de la
          visita).
        </p>
        <p>
          También tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (
          <Ext href="https://www.aepd.es/">www.aepd.es</Ext>).
        </p>
      </>
    ),
  },
  {
    title: 'Cookies y tecnologías similares',
    body: (
      <>
        <p>
          Este sitio utiliza un script de seguimiento propio que se carga desde el dominio del panel de analítica. Este
          script no instala cookies de terceros ni realiza seguimiento publicitario.
        </p>
        <p>
          Si el navegador tiene activado el bloqueo de scripts o se utiliza una extensión de privacidad, el seguimiento
          puede no ejecutarse.
        </p>
      </>
    ),
  },
  {
    title: 'Seguridad',
    body: (
      <p>
        Se aplican medidas técnicas y organizativas adecuadas para proteger los datos contra el acceso no autorizado, la
        pérdida o la alteración (incluyendo el uso de API keys de alta entropía, sentencias preparadas, rate limiting y
        cabeceras de seguridad).
      </p>
    ),
  },
  {
    title: 'Cambios en la política',
    body: (
      <p>
        Nos reservamos el derecho a modificar esta Política de Privacidad para adaptarla a cambios legislativos o de
        funcionamiento. La versión actualizada se publicará en esta misma página con la fecha de la última revisión.
      </p>
    ),
  },
];

export function PrivacyView({ setMode }: { setMode: (m: DiffMode) => void }) {
  const { t, lang } = useI18n();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <button type="button" onClick={() => setMode('text')} className={btnSecondary}>
        <ArrowLeft className="w-3.5 h-3.5" />
        {t('privacy.back')}
      </button>

      <article className={`${card} p-6 sm:p-10`} lang="es">
        <header className="space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6 mb-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('privacy.title')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <strong>Última actualización:</strong> 20/11/2026
          </p>
          {lang === 'en' && (
            <p lang="en" className="text-xs text-slate-500 dark:text-slate-400">
              {t('privacy.langNote')}
            </p>
          )}
        </header>

        {sections.map((s, i) => (
          <section key={s.title} aria-labelledby={`privacy-${i + 1}`} className="mt-8">
            <h2 id={`privacy-${i + 1}`} className="text-lg font-bold text-slate-900 dark:text-white">
              {i + 1}. {s.title}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300 [&_code]:rounded [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">
              {s.body}
            </div>
          </section>
        ))}
      </article>
    </div>
  );
}
