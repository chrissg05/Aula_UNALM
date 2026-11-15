# Aula UNALM

Extensión de navegador que renueva la apariencia del aula virtual de la UNALM (`aula.lamolina.edu.pe`) con un tema oscuro de estilo *liquid glass*.

> **Estado: beta (v1.0), en desarrollo.**
> Proyecto no oficial. No está afiliado ni respaldado por la Universidad Nacional Agraria La Molina.

<img width="1917" height="915" alt="image" src="https://github.com/user-attachments/assets/d8e02fc1-7ddd-48c8-a751-fff006846293" />


## Qué hace

La extensión solo cambia **cómo se ve y se organiza** el aula.

- **Página principal**
  - Une los cursos duplicados (teoría y práctica) en una sola tarjeta. Al hacer clic, un modal permite elegir el aula.
  - Vista de lista o de tarjetas con portada generada para cada curso.
  - Búsqueda, filtro (todos, destacados, teoría y práctica) y cursos destacados con estrella.
  - Toda la tarjeta del curso es clickeable.
- **Bloque de navegación** convertido en una ventana con botones, íconos y etiquetas **T** / **P** para cada curso.
- **Contenido del curso**
  - Cada unidad es una ventana que se puede minimizar.
  - Cada recurso es un botón con ícono y etiqueta según su tipo (PDF, Word, Excel, PowerPoint, video, ZIP, foro, tarea, etc.).
- **Tareas y entregas:** estado de la entrega con insignias y tiempo restante resaltado.
- **Foros:** tabla de temas y publicaciones rediseñadas, avatares con iniciales y botón de suscripción.
- **Calificaciones:** notas y porcentajes con colores según el rango.
- **Mensajería y archivos privados:** estilos adaptados al tema oscuro.
- **Inicio de sesión:** formulario renovado con opción de mostrar u ocultar la contraseña.

## Instalación (modo desarrollador)

Mientras no esté publicada en la Chrome Web Store:

1. Descarga o clona este repositorio.
2. Abre `chrome://extensions` en Chrome (o `edge://extensions` en Edge).
3. Activa el **Modo de desarrollador**.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta `aula`.
5. Entra a [aula.lamolina.edu.pe](https://aula.lamolina.edu.pe).

Para ver los cambios después de editar el código, pulsa el botón de recargar de la extensión y actualiza la página del aula.

## Estructura

```
aula/
├── manifest.json     # Configuración (Manifest V3)
├── content.js        # Lógica: reorganiza y rediseña las páginas del aula
├── style.css         # Tema oscuro liquid glass
├── exterior.jpg      # Fondo de la página de inicio de sesión
└── fonts/
    └── lexend-latin-wght-normal.woff2
```

## Privacidad y seguridad

- **No recopila ni envía datos.** No hay peticiones de red, analíticas ni servidores propios.
- **No lee ni guarda tu contraseña.** El código del login solo cambia el aspecto del formulario.
- **Sin permisos extra.** El manifest no solicita `cookies`, `storage`, `tabs` ni similares. Solo se ejecuta en `https://aula.lamolina.edu.pe/*`.
- **Almacenamiento local:** guarda en `localStorage` de tu navegador únicamente la vista elegida y los cursos que marcas con estrella.
- El texto de la página se inserta con `textContent` y elementos del DOM, no con `innerHTML`, para evitar inyección de HTML.

## Limitaciones conocidas

- Depende de la estructura HTML actual del aula (Moodle). Si la universidad cambia el tema o actualiza Moodle, algunas partes pueden dejar de verse bien.
- Está probada solo en Chromium (Chrome, Edge).
- Todavía en desarrollo: puede haber errores visuales en páginas poco comunes.
