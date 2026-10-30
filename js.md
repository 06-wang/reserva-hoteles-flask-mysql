# Explicación del Frontend en JavaScript (`app.js`)

Este documento explica de forma detallada cada bloque y función que compone el archivo JavaScript principal de la aplicación, el cual se encarga de gestionar la lógica de la interfaz de usuario, la navegación entre pantallas y el consumo de la API de backend.

---

## 1. Variables Globales y Estado de la Aplicación

```javascript
const API = "/api";

let hotelesCache = [];
let busquedaActual = {};
```

* **`API`**: Define la ruta base para realizar las peticiones al backend (ej. `/api/hoteles`, `/api/reservas`).
* **`hotelesCache`**: Una lista en memoria que almacena temporalmente los datos de los hoteles obtenidos en la última búsqueda.
* **`busquedaActual`**: Un objeto que guarda los criterios aplicados por el usuario en la búsqueda activa (ciudad, fechas y cantidad de habitaciones). Sirve para prellenar automáticamente el formulario de reserva posterior.

---

## 2. Inicialización del Documento (`DOMContentLoaded`)

```javascript
document.addEventListener("DOMContentLoaded", () => {
    cargarCiudades();
    configurarFormularioBusqueda();
    configurarBotonesVolver();
    establecerFechasMinimas();
});
```

* **Propósito**: Ejecutar tareas de preparación de la página tan pronto como el HTML haya terminado de cargarse por completo en el navegador.
* **Acciones**:
  1. Carga el menú desplegable de ciudades desde la base de datos.
  2. Asigna controladores de eventos (*event listeners*) al formulario de búsqueda.
  3. Prepara los botones de navegación ("Volver").
  4. Restringe los calendarios para no permitir seleccionar fechas pasadas.

---

## 3. Carga Dinámica de Ciudades (`cargarCiudades`)

```javascript
async function cargarCiudades() {
    try {
        const response = await fetch(`${API}/ciudades`);
        const ciudades = await response.json();
        const select = document.getElementById("ciudad");
        ciudades.forEach((ciudad) => {
            const option = document.createElement("option");
            option.value = ciudad;
            option.textContent = ciudad;
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar ciudades:", error);
    }
}
```

* **Propósito**: Obtener la lista de ciudades desde la base de datos y llenar el selector (`<select id="ciudad">`) de la barra de búsqueda.
* **Funcionamiento**: Llama mediante `fetch` al endpoint `/api/ciudades`, recorre el resultado y añade cada ciudad como una nueva opción (`<option>`) dentro del selector HTML.

---

## 4. Configuración de Formularios y Botones de Retorno

```javascript
function configurarFormularioBusqueda() {
    document.getElementById("form-busqueda").addEventListener("submit", async (e) => {
        e.preventDefault();
        await buscarHoteles();
    });
}

function configurarBotonesVolver() {
    document.getElementById("btn-volver-busqueda").addEventListener("click", () => {
        mostrarVista("vista-busqueda");
    });
    document.getElementById("btn-volver-lista").addEventListener("click", () => {
        mostrarVista("vista-lista");
    });
}
```

* **`configurarFormularioBusqueda`**: Previene que el formulario recargue la página completa al enviar (`e.preventDefault()`) y en su lugar invoca la búsqueda asíncrona de hoteles.
* **`configurarBotonesVolver`**: Añade interactividad a los botones de navegación entre vistas, permitiendo retroceder de la lista al buscador, o del detalle del hotel de vuelta a la lista.

---

## 5. Control de Fechas Mínimas y Validación Dinámica (`establecerFechasMinimas`)

```javascript
function establecerFechasMinimas() {
    const hoy = new Date().toISOString().split("T")[0];
    const fechaEntrada = document.getElementById("fecha-entrada");
    const fechaSalida = document.getElementById("fecha-salida");
    fechaEntrada.min = hoy;
    fechaEntrada.addEventListener("change", () => {
        fechaSalida.min = fechaEntrada.value;
        if (fechaSalida.value && fechaSalida.value <= fechaEntrada.value) {
            const siguiente = new Date(fechaEntrada.value);
            siguiente.setDate(siguiente.getDate() + 1);
            fechaSalida.value = siguiente.toISOString().split("T")[0];
        }
    });
}
```

* **Propósito**: Asegurar que las fechas ingresadas por el usuario sean coherentes.
* **Funcionamiento**:
  1. Bloquea el selector de entrada para que la fecha mínima sea el día actual (`hoy`).
  2. Escucha cambios en la fecha de entrada: en cuanto se selecciona una, establece ese mismo día como la fecha mínima permitida de salida.
  3. Si la fecha de salida seleccionada anteriormente resulta ser igual o anterior a la de entrada, avanza automáticamente la salida al día siguiente.

---

## 6. Búsqueda y Obtención de Hoteles (`buscarHoteles`)

```javascript
async function buscarHoteles() {
    ...
    const params = new URLSearchParams();
    if (ciudad) params.append("ciudad", ciudad);
    ...
    try {
        const response = await fetch(`${API}/hoteles?${params}`);
        const hoteles = await response.json();
        hotelesCache = hoteles;
        mostrarListaHoteles(hoteles);
        mostrarVista("vista-lista");
    } catch (error) {
        mostrarMensaje("Error al buscar hoteles", "error");
    }
}
```

* **Propósito**: Recoger las preferencias del usuario en el formulario y solicitar la lista de hoteles que cumplen con esos requisitos.
* **Funcionamiento**:
  1. Lee los valores del buscador HTML y los almacena en la variable global `busquedaActual`.
  2. Crea y formatea la cadena de parámetros URL mediante `URLSearchParams`.
  3. Envía una petición `GET` a la API, almacena los hoteles en caché y los dibuja en pantalla invocando `mostrarListaHoteles`.
  4. Cambia la interfaz para visualizar la lista de resultados.

---

## 7. Renderizado de Tarjetas de Hoteles (`mostrarListaHoteles`)

```javascript
function mostrarListaHoteles(hoteles) {
    ...
}
```

* **Propósito**: Construir la interfaz de manera dinámica para cada hotel que coincida con la búsqueda.
* **Funcionamiento**:
  * Si no hay resultados, muestra un texto informativo de "No se encontraron hoteles".
  * Para cada hotel, crea una tarjeta (`.hotel-card`) con su imagen principal, nombre, ciudad y precio.
  * Si el usuario incluyó fechas en su búsqueda, el código evalúa la disponibilidad del hotel: si hay stock libre, muestra el número de habitaciones restantes; de lo contrario, muestra un mensaje de "Sin disponibilidad".
  * Asigna un evento `click` a cada tarjeta para navegar al detalle de ese hotel.

---

## 8. Carga de Detalle del Hotel (`mostrarDetalleHotel`)

```javascript
async function mostrarDetalleHotel(hotelId) {
    try {
        const response = await fetch(`${API}/hoteles/${hotelId}`);
        const hotel = await response.json();
        renderizarDetalleHotel(hotel);
        mostrarVista("vista-detalle");
    } catch (error) {
        mostrarMensaje("Error al cargar detalles del hotel", "error");
    }
}
```

* **Propósito**: Solicitar y cargar la ficha informativa completa de un hotel seleccionado.
* **Funcionamiento**: Llama al endpoint de detalle (`/api/hoteles/{id}`) en el backend, pasa los datos a la función encargada de dibujar el detalle en pantalla y cambia a la vista de detalle.

---

## 9. Renderizado de Ficha y Formulario de Reserva (`renderizarDetalleHotel`)

```javascript
function renderizarDetalleHotel(hotel) {
    ...
}
```

* **Propósito**: Crear dinámicamente el HTML de la página de detalle del hotel y su correspondiente formulario de reserva.
* **Funcionamiento**:
  1. Inyecta la imagen de portada y la secundaria, título, descripción, precio y el formulario de reserva en el contenedor.
  2. Pre-llena las fechas y número de habitaciones del formulario usando los valores previamente guardados en la búsqueda global `busquedaActual` para evitar que el usuario tenga que escribirlos nuevamente.
  3. Asigna un evento `submit` al formulario para enviar la reserva.

---

## 10. Envío y Confirmación de Reserva (`enviarReserva`)

```javascript
async function enviarReserva(hotelId) {
    ...
    try {
        const response = await fetch(`${API}/reservas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ... }),
        });
        const resultado = await response.json();
        if (resultado.status === "success") {
            mostrarMensaje(`Reserva confirmada! ID: ${resultado.reserva_id}`, "exito");
            ...
        } else { ... }
    } catch (error) { ... }
}
```

* **Propósito**: Validar y enviar la petición de reserva del cliente al servidor de backend.
* **Validaciones**:
  * Comprueba que todos los campos requeridos estén llenos.
  * Valida en el cliente que la fecha de salida sea estrictamente posterior a la de entrada.
* **Petición**: Realiza un `POST` con cuerpo en JSON conteniendo la reserva.
* **Respuesta**: Si tiene éxito, muestra una alerta de confirmación con el ID generado en la base de datos y vacía el formulario. En caso de no tener disponibilidad (error retornado por el backend), muestra el mensaje de error correspondiente.

---

## 11. Funciones Auxiliares de Interfaz (`mostrarVista` & `mostrarMensaje`)

```javascript
function mostrarVista(vistaId) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(vistaId).classList.add("active");
    document.getElementById("mensaje-container").innerHTML = "";
}

function mostrarMensaje(texto, tipo) {
    const contenedor = document.getElementById("mensaje-container");
    ...
    setTimeout(() => {
        div.remove();
    }, 5000);
}
```

* **`mostrarVista`**: Oculta todas las secciones de tipo vista y hace visible únicamente la que coincida con `vistaId` agregando la clase CSS `.active`.
* **`mostrarMensaje`**: Genera un cuadro de diálogo informativo de color (ej. verde para éxito, rojo para error) con un efecto automático que lo elimina de la interfaz tras transcurrir 5 segundos.
