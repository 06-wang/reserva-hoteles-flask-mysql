const API = "/api";

let hotelesCache = [];
let busquedaActual = {};

document.addEventListener("DOMContentLoaded", () => {
    cargarCiudades();
    configurarFormularioBusqueda();
    configurarBotonesVolver();
    establecerFechasMinimas();
});

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

async function buscarHoteles() {
    const ciudad = document.getElementById("ciudad").value;
    const fechaEntrada = document.getElementById("fecha-entrada").value;
    const fechaSalida = document.getElementById("fecha-salida").value;
    const habitaciones = document.getElementById("habitaciones").value;

    busquedaActual = { ciudad, fechaEntrada, fechaSalida, habitaciones };

    const params = new URLSearchParams();
    if (ciudad) params.append("ciudad", ciudad);
    if (fechaEntrada) params.append("fecha_entrada", fechaEntrada);
    if (fechaSalida) params.append("fecha_salida", fechaSalida);
    if (habitaciones) params.append("habitaciones", habitaciones);

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

function mostrarListaHoteles(hoteles) {
    const contenedor = document.getElementById("lista-hoteles");
    contenedor.innerHTML = "";

    if (hoteles.length === 0) {
        contenedor.innerHTML = '<div class="no-results">No se encontraron hoteles con esos criterios.</div>';
        return;
    }

    hoteles.forEach((hotel) => {
        const card = document.createElement("div");
        card.className = "hotel-card";
        card.addEventListener("click", () => mostrarDetalleHotel(hotel.id));

        const hayBusqueda = busquedaActual.fechaEntrada && busquedaActual.fechaSalida;
        const disponibilidadHTML = hayBusqueda
            ? hotel.habitaciones_disponibles > 0
                ? `<div class="disponibilidad">${hotel.habitaciones_disponibles} habitaciones disponibles</div>`
                : '<div class="disponibilidad sin-disponibilidad">Sin disponibilidad</div>'
            : "";

        card.innerHTML = `
            <img src="${hotel.imagen_principal}" alt="${hotel.nombre}">
            <div class="hotel-card-body">
                <h3>${hotel.nombre}</h3>
                <p class="ciudad">${hotel.ciudad}</p>
                <p class="precio">${hotel.precio_noche}€ <span>/ noche</span></p>
                ${disponibilidadHTML}
            </div>
        `;
        contenedor.appendChild(card);
    });
}

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

function renderizarDetalleHotel(hotel) {
    const contenedor = document.getElementById("hotel-detalle");
    const { fechaEntrada, fechaSalida, habitaciones } = busquedaActual;

    contenedor.innerHTML = `
        <div class="hotel-detail">
            <div class="hotel-detail-images">
                <img src="${hotel.imagen_principal}" alt="${hotel.nombre}">
                <img src="${hotel.imagen_secundaria}" alt="${hotel.nombre} - vista secundaria">
            </div>
            <div class="hotel-detail-content">
                <h2>${hotel.nombre}</h2>
                <p class="ciudad">${hotel.ciudad}</p>
                <p class="descripcion">${hotel.descripcion}</p>
                <p class="precio-grande">${hotel.precio_noche}€ / noche</p>
                <div class="reserva-form">
                    <h3>Reservar</h3>
                    <form id="form-reserva">
                        <input type="hidden" id="reserva-hotel-id" value="${hotel.id}">
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="reserva-nombre">Nombre</label>
                                <input type="text" id="reserva-nombre" required placeholder="Tu nombre completo">
                            </div>
                            <div class="form-group">
                                <label for="reserva-habitaciones">Habitaciones</label>
                                <input type="number" id="reserva-habitaciones" min="1" value="${habitaciones || 1}" required>
                            </div>
                            <div class="form-group">
                                <label for="reserva-entrada">Fecha de entrada</label>
                                <input type="date" id="reserva-entrada" value="${fechaEntrada || ""}" required>
                            </div>
                            <div class="form-group">
                                <label for="reserva-salida">Fecha de salida</label>
                                <input type="date" id="reserva-salida" value="${fechaSalida || ""}" required>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">Confirmar reserva</button>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.getElementById("form-reserva").addEventListener("submit", async (e) => {
        e.preventDefault();
        await enviarReserva(hotel.id);
    });
}

async function enviarReserva(hotelId) {
    const nombreCliente = document.getElementById("reserva-nombre").value;
    const fechaEntrada = document.getElementById("reserva-entrada").value;
    const fechaSalida = document.getElementById("reserva-salida").value;
    const numeroHabitaciones = parseInt(document.getElementById("reserva-habitaciones").value);

    if (!nombreCliente || !fechaEntrada || !fechaSalida) {
        mostrarMensaje("Por favor, completa todos los campos", "error");
        return;
    }

    if (fechaSalida <= fechaEntrada) {
        mostrarMensaje("La fecha de salida debe ser posterior a la de entrada", "error");
        return;
    }

    try {
        const response = await fetch(`${API}/reservas`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                hotel_id: hotelId,
                nombre_cliente: nombreCliente,
                fecha_entrada: fechaEntrada,
                fecha_salida: fechaSalida,
                numero_habitaciones: numeroHabitaciones,
            }),
        });

        const resultado = await response.json();

        if (resultado.status === "success") {
            mostrarMensaje(`Reserva confirmada! ID: ${resultado.reserva_id}`, "exito");
            document.getElementById("form-reserva").reset();
        } else {
            mostrarMensaje(resultado.message || "Error al crear la reserva", "error");
        }
    } catch (error) {
        mostrarMensaje("Error de conexión al crear la reserva", "error");
    }
}

function mostrarVista(vistaId) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById(vistaId).classList.add("active");
    document.getElementById("mensaje-container").innerHTML = "";
}

function mostrarMensaje(texto, tipo) {
    const contenedor = document.getElementById("mensaje-container");
    const div = document.createElement("div");
    div.className = `mensaje mensaje-${tipo}`;
    div.textContent = texto;
    contenedor.innerHTML = "";
    contenedor.appendChild(div);
    setTimeout(() => {
        div.remove();
    }, 5000);
}
