# CardFlow AI

Una aplicación web de flashcards interactiva para aprender cualquier idioma: inglés, francés, portugués, alemán, japonés, italiano o cualquier combinación que quieras practicar. CardFlow AI propone rondas cortas de estudio: muestra una tarjeta, permite voltearla para ver la traducción y pide una autoevaluación al estilo Tinder. Es una aplicación estática, sin servidor ni dependencias, preparada para publicarse gratis en el repositorio oficial [CONTERNICO845/CardFlow-AI](https://github.com/CONTERNICO845/CardFlow-AI).

## Características

- Configuración de tarjetas por ronda, tiempo por tarjeta y descansos sugeridos.
- Importación mediante pegado de JSON o carga/arrastre de un archivo `.json`.
- Tarjeta responsiva con giro 3D; funciona con clic, toque y teclado.
- Modo oscuro de alto contraste como experiencia inicial; la preferencia elegida se recuerda en el navegador.
- Frente azul-negro profundo y reverso gris elevado con borde cian luminoso para que el volteo sea inequívoco y muy legible.
- Evaluación en tres direcciones: izquierda = “sí la supe” (verde), derecha = “aún no” (rojo) y abajo = “repasar” (amarillo).
- Resumen de la ronda y acceso directo para repasar las tarjetas pendientes.
- Sin compilación, cuentas, ni datos enviados a terceros.

## Ejecutar localmente

1. Descarga o clona el repositorio.
2. Abre `index.html` en el navegador. Para que el botón “Usar tarjetas de ejemplo” pueda cargar el archivo automáticamente, abre la carpeta mediante un servidor local sencillo (por ejemplo, Live Server en VS Code).
3. Pega un arreglo JSON, carga `sample.json` o utiliza el botón de ejemplo.
4. Ajusta la sesión y selecciona **Empezar a estudiar**.

La aplicación se puede usar con cualquier conjunto de idiomas: `front` representa el término que quieres practicar y `back` su respuesta, traducción o definición.

## Formato de las tarjetas

El contenido debe ser un arreglo JSON válido. Cada objeto requiere las claves `front` y `back` como texto.

```json
[
  { "front": "Good morning", "back": "Buenos días" },
  { "front": "See you soon", "back": "Hasta pronto" }
]
```

Hay un conjunto de prueba disponible en [`sample.json`](sample.json).

## Generar JSON multilingüe con IA

1. Copia el mini-prompt de abajo (también está disponible dentro de la pantalla inicial de CardFlow AI).
2. Pégalo en ChatGPT, Claude o la IA que prefieras. Si no indicas idiomas, la IA te preguntará cuál quieres practicar y a cuál quieres traducir.
3. Envía tu lista de palabras, expresiones o frases; puede estar separada por comas, espacios o saltos de línea.
4. Pégala en la pestaña **Pegar JSON** de CardFlow AI, revisa que aparezca el mensaje de tarjetas listas e inicia la ronda.

> Actúa como un generador de flashcards JSON multilingüe. Antes de procesar mi lista, realiza lo siguiente:
>
> 1. Si no especifico los idiomas en mi primer mensaje, pregúntame: '¿Qué idioma quieres practicar?' y '¿A qué idioma quieres traducirlo?'.
> 2. Si detectas los idiomas automáticamente en las palabras/frases que te envíe, procede directamente.
> 3. Procesa la lista de términos (separados por comas, saltos de línea o espacios) y tradúcelos de forma natural.
> 4. Genera EXCLUSIVAMENTE un arreglo JSON válido con la estructura [{'front': 'término a practicar', 'back': 'traducción/significado'}]. No agregues texto ni explicaciones adicionales fuera del código JSON.

Consejo: si la IA incluye delimitadores como ```` ```json ```` o un comentario, elimínalos antes de pegar el resultado para conservar JSON válido.

## Desplegar en GitHub Pages

1. Crea un repositorio llamado `CardFlow-AI` en GitHub o utiliza el repositorio público [CONTERNICO845/CardFlow-AI](https://github.com/CONTERNICO845/CardFlow-AI).
2. Sube estos cinco archivos a la raíz del repositorio: `index.html`, `style.css`, `app.js`, `sample.json` y `README.md`.
3. En GitHub, abre **Settings → Pages**.
4. En **Build and deployment**, selecciona **Deploy from a branch**.
5. Elige la rama `main` y la carpeta `/(root)`, y pulsa **Save**.
6. Cuando GitHub termine de publicar, abre la URL que muestra esa misma página. Normalmente seguirá el formato `https://CONTERNICO845.github.io/CardFlow-AI/`.

Como todas las rutas son relativas y no hay backend, no hace falta ninguna variable de entorno ni configuración adicional.

## Modo Plan / Arquitectura Técnica

### Cómo está organizado

```text
index.html   → estructura, pantallas y controles accesibles
style.css    → diseño responsive, flip 3D, estados de gesto y resumen
app.js       → datos, validación, temporizador, gestos, resultados y navegación
sample.json  → contenido de prueba reutilizable
```

`app.js` conserva el estado de una ronda en memoria: tarjetas disponibles, orden mezclado, índice actual y tres grupos de resultados (`knew`, `review`, `missed`). Al comenzar, valida el arreglo JSON y toma el número configurado de tarjetas. Cada respuesta anima la salida de la tarjeta y la envía a su grupo correspondiente. Al final, la pantalla de resumen calcula el porcentaje de dominadas y puede lanzar una ronda nueva solo con las pendientes.

Los gestos se manejan con Pointer Events, por lo que el mismo código responde a ratón, pantalla táctil y lápiz. Los atajos mantienen la correspondencia visual: `←` la supe, `→` aún no y `↓` repasar. Si el temporizador está activo y llega a cero, la tarjeta se asigna a repaso.

### Roadmap propuesto

1. **Repetición espaciada SM-2:** guardar dificultad, fecha de próxima revisión y el factor de facilidad para priorizar cada tarjeta.
2. **Síntesis de voz (TTS):** usar Web Speech API para pronunciar el contenido de `front`, con selector de voz, idioma y velocidad.
3. **Persistencia con localStorage:** conservar mazos, ajustes de sesión e historial de progreso directamente en el navegador.
4. **Mazos y métricas:** permitir importar/exportar varios mazos, buscar tarjetas y mostrar evolución por día.

## Licencia

Puedes adaptar este proyecto para fines educativos y personales. Añade una licencia concreta (por ejemplo, MIT) antes de redistribuirlo como proyecto público.
