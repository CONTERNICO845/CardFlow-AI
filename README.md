# CardFlow AI

Aplicación web estática para practicar idiomas. Incluye dos módulos: una sesión de **flashcards** con temporizador y autoevaluación, y **Exámenes Rápidos** para practicar tiempos verbales en inglés mediante ejercicios de completar espacios.

No requiere instalación, backend ni dependencias. Puede abrirse en un navegador o publicarse con GitHub Pages.

## Módulos

### Flashcards

Es la primera opción del menú. Permite pegar o cargar un arreglo JSON de tarjetas, definir tamaño de ronda, temporizador y descanso. Cada tarjeta se puede voltear y clasificarse como “la supe”, “repasar” o “aún no”; al terminar se muestra un resumen y se pueden repasar sólo las pendientes.

Formato esperado:

```json
[
  { "front": "Good morning", "back": "Buenos días" },
  { "front": "See you soon", "back": "Hasta pronto" }
]
```

### Exámenes Rápidos

1. Selecciona uno o más tiempos verbales y la dificultad. La dificultad define la extensión: fácil (2 párrafos/6 espacios), medio (3/10) o difícil (4/14).
2. Copia la instrucción generada y pégala en la IA de tu elección.
3. Pega el objeto JSON devuelto en la aplicación y cárgalo.
4. Completa los espacios; en fácil y medio verás el verbo base entre paréntesis, mientras que en difícil no hay pista. El Banco de Palabras puede activarse como ayuda y sólo muestra verbos en forma base.
5. Al calificar, la comparación ignora mayúsculas, minúsculas y espacios repetidos. Los resultados indican las respuestas erróneas y agrupan los errores por tiempo verbal.

El lector valida que cada marcador `{{id}}` del texto tenga una pregunta asociada. Cada pregunta requiere tanto `baseForm` (infinitivo, usado para las pistas) como `correctAnswer` (forma conjugada que se valida). La IA debe devolver únicamente un objeto JSON con esta forma:

```json
{
  "version": "1.0",
  "title": "English verb tenses practice",
  "instructions": "Complete every blank with the correct form of the verb.",
  "difficulty": "Medio",
  "selectedTenses": ["Present Simple", "Past Simple"],
  "paragraphs": [
    {
      "id": "p1",
      "text": "Every morning, Laura {{b1}} coffee. Last Saturday, she {{b2}} a new recipe.",
      "questions": [
        {
          "id": "b1",
          "sentence": "Every morning, Laura ___ coffee.",
          "baseForm": "make",
          "correctAnswer": "makes",
          "verbTense": "Present Simple"
        },
        {
          "id": "b2",
          "sentence": "Last Saturday, she ___ a new recipe.",
          "baseForm": "try",
          "correctAnswer": "tried",
          "verbTense": "Past Simple"
        }
      ]
    }
  ]
}
```

## Arquitectura

```text
index.html  estructura de las pantallas y componentes accesibles
style.css   diseño responsive, temas y estilos de ambos módulos
app.js      estado, navegación, flashcards, validación y motor de exámenes
sample.json tarjetas de demostración
```

La navegación usa una tabla de rutas simple en `app.js`; para añadir una nueva sección se registra su ruta, su pantalla y un botón de menú. El motor de exámenes está separado en funciones para generar la instrucción, validar el JSON, renderizar las respuestas y calificarlo.

## Uso local

Abre `index.html` en un navegador. Para que “Usar tarjetas de ejemplo” cargue automáticamente `sample.json`, utiliza un servidor local sencillo (por ejemplo, Live Server). También puede publicarse directamente desde la raíz del repositorio en GitHub Pages.
