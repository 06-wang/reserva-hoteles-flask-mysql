# Reserva de Hoteles
Trabajo de Gestión de Bases de Datos y Programación en Python

## Descripción

Aplicación web para reservar hoteles. Usa una base de datos MySQL con un procedimiento almacenado y triggers, y un backend en Python con Flask que ofrece una API REST. El usuario puede buscar hoteles por ciudad y fechas, ver su ficha y hacer una reserva, y el sistema comprueba que queden habitaciones libres antes de confirmarla. Todo se levanta con Docker Compose.

## Estructura

```
├── init-db/init.sql          # Base de datos: tablas, datos, procedimiento y triggers
├── backend/main.py           # API en Python con Flask
├── frontend/                 # Página web (HTML, CSS y JavaScript)
├── nginx/default.conf        # Configuración de Nginx
├── docker-compose.yml        # Servicios de Docker
├── python.md                 # Explicación del backend
└── js.md                     # Explicación del frontend
```

## Base de datos

La base de datos `bd1` se crea con `init.sql` y tiene tres tablas: `hoteles` (nombre, ciudad, precio por noche y número de habitaciones), `reservas` (cliente, fechas y habitaciones, relacionada con `hoteles` mediante una clave foránea) y `auditoria_reservas` (registro de los cambios). Incluye ocho hoteles de ejemplo.

El procedimiento almacenado `habitaciones_disponibles` calcula cuántas habitaciones quedan libres de un hotel en un rango de fechas, restando las reservas que se solapan con ese rango. Además, tres triggers (`INSERT`, `UPDATE` y `DELETE`) anotan automáticamente en `auditoria_reservas` cada cambio hecho en `reservas`.

## Backend en Python

El backend está en `main.py`, usa Flask y `mysql-connector-python`, y lee los datos de conexión de variables de entorno. Sus rutas son:

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/hoteles` | Lista hoteles, con filtros por ciudad, fechas y habitaciones |
| GET | `/api/hoteles/<id>` | Ficha de un hotel |
| POST | `/api/reservas` | Crea una reserva |
| GET | `/api/ciudades` | Lista de ciudades |
| GET | `/api/test-db` | Prueba la conexión con MySQL |
| GET | `/health` | Estado del backend |

Las consultas usan parámetros (`%s`) para evitar la inyección SQL. Al crear una reserva se valida que lleguen todos los campos (error 400), que el hotel exista (404) y que haya habitaciones suficientes (409); si todo es correcto se guarda y se responde con un 201. Los errores de MySQL se capturan y la conexión se cierra siempre en un bloque `finally`.

## Cómo ejecutarlo

Con Docker y Docker Compose instalados, desde la carpeta del proyecto:

```
docker compose up --build
```

La aplicación queda en `http://localhost`, phpMyAdmin en `http://localhost:8081` y MySQL en el puerto 3306. Para pararlo se usa `docker compose down`, y si se cambia `init.sql` hay que borrar también los datos con `docker compose down -v` para que se aplique de nuevo.

El usuario y la contraseña de MySQL son `root` y `root`, solo para usar en local.

## Autor

Siyu, estudiante de 2º de ASIR.
