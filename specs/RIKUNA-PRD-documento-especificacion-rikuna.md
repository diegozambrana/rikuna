# Rikuna — Documento de Especificación de Producto

> Versión 3 — nombre definido: **Rikuna**, del quechua, "lo que se debe ver". Se mantiene el enfoque de la versión 2 (planificador personal de rotación de streaming) y se resuelve el modelo de visibilidad de listas: públicas accesibles sin cuenta, privadas solo para el dueño.

## 1. Resumen Ejecutivo

Rikuna es una herramienta personal que responde una pregunta muy concreta: **"este mes contraté tal servicio de streaming, ¿qué de todo lo que quiero ver puedo ver ahora?"**. El nombre viene del quechua y significa "lo que se debe ver" — resume bien la idea: una lista curada, personal, de lo que vale la pena ver.

Toma como insumo el historial real del usuario en IMDb (sus calificaciones, que representan lo que ya vio, y su lista de seguimiento, que representa lo que quiere ver), lo cruza con el catálogo disponible en el servicio de streaming contratado en ese momento, y genera una lista accionable de qué ver. Además recomienda títulos bien calificados que el usuario todavía no ha visto y que están disponibles ahora.

Resuelve un problema real de quien rota de servicio de streaming: cada mes se paga por un catálogo distinto y no hay forma práctica de saber qué de la lista de pendientes personal está disponible en ese catálogo específico.

## 2. Objetivo del Negocio

**Objetivo principal:** maximizar el aprovechamiento de cada suscripción mensual, convirtiendo una watchlist dispersa e histórica en un plan concreto de qué ver este mes.

**Cómo se mide el éxito:**
- Que al inicio de cada ciclo de suscripción la herramienta produzca una lista útil sin trabajo manual.
- Porcentaje de la watchlist personal que logra cruzarse correctamente con el catálogo disponible (tasa de coincidencia).
- Que el historial se mantenga actualizado con mínimo esfuerzo (importaciones periódicas de IMDb sin fricción).

En esta etapa no hay objetivo de monetización: es una herramienta de uso propio que después podrá abrirse a más usuarios.

## 3. Público Objetivo

**Etapa 1 — Usuario único (el propio dueño del proyecto).** Alguien que lleva un registro disciplinado en IMDb (califica lo que ve, guarda lo que quiere ver) y que rota de servicio de streaming mes a mes en lugar de mantener varias suscripciones simultáneas.

**Etapa 2 — Multiusuario.** Otras personas con el mismo hábito: registro activo en IMDb y rotación de servicios. La necesidad es idéntica, solo cambia la escala.

**Necesidades clave:**
- "Ya vi esto, no me lo muestres" → requiere historial confiable de lo visto.
- "Quiero ver esto desde hace años" → requiere que la watchlist histórica esté cargada y viva.
- "¿Qué de eso está en el servicio que pago ahora?" → requiere disponibilidad por plataforma y país, actualizada.
- "Sugiéreme algo bueno que no conozca" → requiere recomendación por calificación sobre lo disponible.

## 4. Tipo de Producto Digital

**Aplicación web con lógica de negocio y usuarios registrados.**

Justificación: el valor no está en mostrar contenido, sino en el **cruce de tres conjuntos de datos** (lo visto, lo que se quiere ver, y lo disponible ahora). Eso es lógica de negocio real, no un sitio de contenido. Requiere cuentas de usuario porque los datos son personales, y requiere persistencia porque el historial se acumula y la disponibilidad cambia mes a mes.

Aunque la Etapa 1 es de un solo usuario, se construye con soporte multiusuario desde el inicio: cada dato personal queda asociado a una cuenta. Agregar esa separación después sería un rediseño costoso; dejarla desde el principio no agrega complejidad significativa.

## 5. Propuesta de Valor y Tono de Marca

**Mensaje principal:** "Tu watchlist de IMDb, cruzada con el streaming que pagas este mes."

**Diferenciadores:**
- Parte del historial real del usuario, no de un perfil construido desde cero.
- Sabe qué ya viste (vía calificaciones de IMDb), así que nunca sugiere repetido.
- Se adapta al servicio contratado en ese momento, en lugar de asumir que tienes todas las plataformas.

**Tono de marca:** utilitario y directo — es una herramienta de trabajo personal, no una red social. Prioriza densidad de información y rapidez de decisión sobre estética elaborada. Identidad visual aún sin definir (ver Sección 13).

## 6. Funcionalidades Clave

### Imprescindibles (MVP)

| # | Funcionalidad | Descripción |
|---|---|---|
| 1 | Cuenta y sesión | Registro e inicio de sesión (base para multiusuario futuro) |
| 2 | Importar calificaciones de IMDb | Subir el CSV de *Your Ratings* → marca títulos como **ya vistos** con tu calificación |
| 3 | Importar lista de seguimiento de IMDb | Subir el CSV de *Watchlist* → marca títulos como **quiero ver** |
| 4 | Declarar suscripción activa | Indicar qué servicio de streaming tienes contratado ahora y en qué país |
| 5 | Vista "Qué ver este mes" | Cruce: watchlist ∩ disponible en tu servicio ∩ no visto, ordenado por calificación |
| 6 | Recomendaciones por descubrimiento | Títulos con mejor calificación disponibles ahora, no vistos y **fuera** de tu watchlist |
| 7 | Ficha de título | Datos de IMDb (poster, sinopsis, año, calificación, votos, géneros, elenco) + enlaces para ver |
| 8 | Marcar visto / no visto manualmente | Sin depender de reimportar desde IMDb |
| 9 | Gestión libre de listas | Crear, editar y ordenar listas propias más allá de las importadas |
| 10 | Listas públicas o privadas, con enlace compartible | Cada lista se marca pública o privada; una lista pública se puede ver **sin necesidad de iniciar sesión** compartiendo su enlace; una privada no es accesible por nadie más que el dueño |

### Deseables (fases posteriores)

- Historial de suscripciones y estadística de aprovechamiento por servicio.
- Multiusuario completo: que otras personas se registren y gestionen sus propios datos (la función de listas públicas por enlace, en cambio, ya es parte del MVP — ver punto 10).
- Seguimiento a nivel de episodio para series.
- Alertas de "esto sale del catálogo pronto".

**Aclaración sobre el punto 10:** esto no depende de tener más usuarios registrados. Aunque en la Etapa 1 solo tú uses la cuenta, sirve para poder mandarle a alguien el enlace de una lista puntual (ej. "las pelis que quiero ver este finde") sin que esa persona necesite crear una cuenta ni iniciar sesión — y para que todo lo demás (tu historial completo, tu watchlist general, tus suscripciones) permanezca privado por defecto.

## 7. Mapa de Vistas / Pantallas

> Sección redactada para servir de insumo directo a una herramienta de generación de interfaces.

### 7.1 Inicio de sesión / Registro
- **Propósito:** acceso seguro a los datos personales.
- **Contenido:** correo, contraseña; enlaces entre login y registro y a recuperación de contraseña.
- **Acciones:** ingresar → lleva al Panel principal.

### 7.2 Panel principal ("Qué ver este mes")
- **Propósito:** vista de aterrizaje; responde la pregunta central del producto.
- **Contenido:** encabezado con el servicio activo y el país; contador de títulos disponibles de tu watchlist; cuadrícula de resultados (poster, título, año, calificación IMDb, géneros).
- **Acciones:** click en un título → Ficha de detalle. Cambiar servicio activo → Mis suscripciones. Marcar como visto directamente desde la tarjeta.

### 7.3 Recomendaciones
- **Propósito:** descubrimiento de títulos buenos fuera de la watchlist.
- **Contenido:** dos bloques separados y claramente etiquetados: (a) "De tu lista de seguimiento", (b) "Descubre algo nuevo" — títulos no vistos, no en watchlist, con calificación alta y volumen de votos suficiente. Filtro por género.
- **Acciones:** agregar a watchlist, marcar como no interesado (para que no vuelva a aparecer), abrir ficha.

### 7.4 Mis suscripciones
- **Propósito:** declarar y cambiar el servicio de streaming contratado.
- **Contenido:** servicio activo actual con fecha de inicio; historial de suscripciones anteriores; selector de plataforma y país.
- **Acciones:** activar un nuevo servicio (cierra el anterior), editar fechas.

### 7.5 Importar desde IMDb
- **Propósito:** cargar y actualizar el historial personal.
- **Contenido:** instrucciones breves de cómo exportar desde IMDb; zona para subir archivo; selector del tipo de archivo (calificaciones o lista de seguimiento); historial de importaciones previas con su resumen.
- **Acciones:** subir archivo → procesar → mostrar resumen (cuántos títulos se reconocieron, cuántos se crearon nuevos, cuántos fallaron).

### 7.6 Detalle de importación
- **Propósito:** transparencia sobre qué pasó con cada fila del archivo.
- **Contenido:** tabla con título, identificador de IMDb, resultado (reconocido / creado / omitido).
- **Acciones:** volver a Importar.

### 7.7 Ficha de título
- **Propósito:** toda la información para decidir si verlo.
- **Contenido:** poster, título, año, sinopsis, calificación IMDb y cantidad de votos, géneros, elenco principal, tu calificación personal si existe; sección "Dónde ver" con los servicios donde está disponible y su enlace, indicando cuál de ellos tienes contratado.
- **Acciones:** marcar visto/no visto, agregar o quitar de watchlist, agregar a una lista propia, abrir enlace externo del servicio.

### 7.8 Mi biblioteca
- **Propósito:** explorar y gestionar todo el historial personal.
- **Contenido:** pestañas de "Vistas", "Quiero ver", "Todas"; filtros por tipo (película/serie), género, año, rango de calificación y disponibilidad en el servicio activo; buscador por título.
- **Acciones:** cambiar estado de un título, abrir ficha.

### 7.9 Mis listas
- **Propósito:** organización libre más allá de lo importado.
- **Contenido:** listas propias con nombre, cantidad de títulos y un control claro de visibilidad (pública / privada) por lista; detalle de cada lista con sus títulos ordenables; si es pública, un botón para copiar el enlace compartible.
- **Acciones:** crear, renombrar, reordenar, eliminar, agregar/quitar títulos, cambiar visibilidad, copiar enlace.

### 7.10 Lista pública (vista sin sesión)
- **Propósito:** que cualquier persona con el enlace pueda ver una lista pública, sin necesidad de tener cuenta ni iniciar sesión.
- **Contenido:** nombre de la lista, descripción opcional, cuadrícula de los títulos incluidos (poster, título, año, calificación IMDb). No muestra nada del resto de la cuenta del dueño (ni su historial, ni sus suscripciones, ni sus otras listas privadas).
- **Acciones:** click en un título → lleva a una ficha de detalle también accesible sin sesión, con la información pública del título (sin las acciones personales como "marcar visto", que sí requieren estar en sesión).
- **Nota de diseño:** esta vista vive fuera del área que exige inicio de sesión — es la única parte de Rikuna pensada para visitantes sin cuenta.

## 8. Flujo de Usuario

**Flujo de configuración inicial (una sola vez):**
1. El usuario crea su cuenta.
2. Va a "Importar desde IMDb" y sube su CSV de calificaciones → el sistema registra todo lo que ya vio.
3. Sube su CSV de lista de seguimiento → el sistema registra todo lo que quiere ver.
4. Va a "Mis suscripciones" y declara el servicio que tiene contratado y su país.

**Flujo principal (recurrente, al inicio de cada mes o al cambiar de servicio):**
1. El usuario cambia el servicio activo en "Mis suscripciones".
2. Entra al Panel principal y ve inmediatamente qué de su watchlist está disponible en ese servicio.
3. Revisa "Recomendaciones" para descubrir títulos adicionales bien calificados.
4. Ve el contenido y marca como visto lo que va terminando.

**Flujo de mantenimiento (periódico):**
1. Cada cierto tiempo el usuario reexporta sus CSV desde IMDb y los vuelve a subir.
2. El sistema reconcilia: agrega lo nuevo, actualiza calificaciones y respeta lo que ya fue marcado manualmente en la app.

## 9. Necesidad de Datos y Persistencia

| Tipo de dato | Descripción | Frecuencia de cambio |
|---|---|---|
| Catálogo de títulos | Datos de películas y series originados en IMDb | Crece con cada importación y cada carga de catálogo |
| Disponibilidad por servicio y país | Qué título está en qué plataforma, en qué país, con qué enlace | **Alta** — rota mensualmente; requiere saber cuándo se verificó por última vez |
| Historial personal | Qué vi, cuándo, con qué calificación; qué quiero ver | Cambia constantemente |
| Suscripciones del usuario | Qué servicio tiene contratado y desde cuándo | Mensual |
| Listas propias | Agrupaciones libres del usuario | A voluntad |
| Registro de importaciones | Qué archivo se subió, qué se procesó y con qué resultado | Cada importación |

**Punto crítico:** la disponibilidad **no puede tratarse como un dato estático**. Los catálogos de streaming cambian cada mes; si un título sale de un servicio y el sistema sigue mostrándolo como disponible, el producto pierde su razón de ser. Por eso debe registrarse cuándo se verificó cada disponibilidad por última vez, y marcarse como no disponible lo que dejó de aparecer.

## 10. Integraciones y Funcionalidades de Terceros

**A nivel de necesidad, no de proveedor:**

1. **Fuente de catálogo y disponibilidad:** un proceso externo (ya existente) genera periódicamente un archivo por plataforma y país con los títulos disponibles. La plataforma debe poder ingerir esos archivos de forma repetible.
2. **Exportaciones de IMDb:** archivos CSV descargados manualmente por el usuario. **IMDb no ofrece una API pública ni conexión de cuenta**, por lo que la sincronización automática no es posible; la importación por archivo es el único mecanismo oficial disponible.
3. **Enlaces a servicios de streaming:** enlaces externos de solo salida, sin integración.
4. **Correo transaccional:** confirmación de cuenta y recuperación de contraseña.

**Decisión de diseño importante sobre el proceso externo:** hoy ese proceso ya calcula listas derivadas (lo disponible de la watchlist, lo no visto bien calificado, recomendaciones). Se recomienda que **deje de hacerlo** y entregue únicamente el catálogo crudo de disponibilidad. La razón: si las listas vienen precalculadas en el archivo, marcar un título como visto en la app no tendría ningún efecto hasta regenerar el archivo, y la app dejaría de ser una herramienta interactiva para volverse un simple visor.

## 11. Consideraciones de Buenas Prácticas

- **Mobile-first:** la decisión de "qué veo ahora" suele tomarse frente al televisor, con el celular en la mano.
- **Velocidad de carga:** el panel principal cruza tres conjuntos de datos; debe sentirse instantáneo aun con miles de títulos en el historial.
- **Transparencia en la importación:** el usuario debe entender qué se importó, qué no coincidió y por qué. Una importación silenciosa que pierde la mitad de la watchlist destruye la confianza en la herramienta.
- **No perder datos del usuario:** las marcas manuales hechas en la app no deben ser sobrescritas ciegamente por una reimportación.
- **Privacidad:** el historial de lo que una persona ve es información sensible. Debe estar aislado por cuenta desde el diseño, aunque hoy exista un solo usuario. La regla es simple y no debe tener excepciones ocultas: una lista es pública solo si el dueño lo marca explícitamente, y solo esa lista puntual queda visible — nunca el resto de la cuenta (historial de vistas, watchlist general, suscripciones). Todo lo demás es privado por defecto.
- **Accesibilidad y SEO básicos:** contraste legible, texto alternativo en posters; estructura preparada para la etapa pública.

## 12. Alcance y Fases (Roadmap)

**Fase 1 — MVP personal:**
- Cuenta y sesión.
- Importación de ambos CSV de IMDb (calificaciones y lista de seguimiento), con creación automática de títulos que aún no existan en el catálogo.
- Ingesta del catálogo de disponibilidad desde los archivos del proceso externo.
- Declaración del servicio activo.
- Panel "Qué ver este mes".
- Recomendaciones por descubrimiento.
- Ficha de título con enlaces para ver.
- Marcado manual de visto / quiero ver.
- Listas propias con visibilidad pública/privada y enlace compartible sin necesidad de sesión.

**Fase 2 — Refinamiento personal:**
- Gestión avanzada de listas propias.
- Filtros y buscador completos en "Mi biblioteca".
- Historial de suscripciones y estadística de aprovechamiento.
- Enriquecimiento de títulos incompletos (poster, sinopsis, elenco) creados desde CSV.

**Fase 3 — Apertura multiusuario:**
- Registro de otros usuarios con sus propias importaciones y suscripciones.
- Descubrimiento entre usuarios (ver listas públicas de otras cuentas, no solo las propias).
- Perfiles públicos.

## 13. Riesgos, Dudas y Decisiones Pendientes

- **Catálogo de series incompleto:** el archivo de ejemplo del proceso externo incluye un catálogo completo de películas, pero para series solo entrega listas derivadas y no el catálogo íntegro. Sin ese catálogo completo, la disponibilidad de series quedará parcial. **Requiere ajustar el proceso externo.**
- **Traslado de la lógica de recomendación:** decidir formalmente que el proceso externo entregue datos crudos y que la app calcule las listas derivadas (ver Sección 10).
- **Enlaces profundos por título:** el archivo actual trae el enlace a IMDb, pero no el enlace directo al título dentro de cada servicio de streaming. Falta definir si el proceso externo puede obtenerlos o si se enlazará a la página general del servicio.
- **Datos faltantes en títulos creados desde CSV:** poster, sinopsis y elenco no vienen en las exportaciones de IMDb. Falta definir cómo se completan (proceso de enriquecimiento posterior, o dejarlos incompletos).
- **Política de reconciliación:** definir qué ocurre cuando un título fue quitado de la watchlist en IMDb pero sigue marcado como "quiero ver" en la app.
- **Cobertura por país:** el proceso genera archivos por país; confirmar qué países se mantendrán activos.
- **Identidad de marca:** nombre definitivo y dirección visual sin definir.

## 14. Próximos Pasos

1. Validar este documento y confirmar los pendientes de la Sección 13, especialmente el catálogo completo de series y el traslado de la lógica de recomendación.
2. Revisar el documento de esquema de base de datos, que acompaña a este y traduce estas necesidades en estructura de datos.
3. Usar la Sección 7 como insumo directo para generar los primeros bocetos de interfaz.
4. Cuando quieras, podemos detallar las reglas exactas de reconciliación entre importaciones y marcas manuales, o el algoritmo de recomendación por descubrimiento.
