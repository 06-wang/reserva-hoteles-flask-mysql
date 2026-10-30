# Explicación del backend en Python (`main.py`)

Este documento detalla la estructura y el comportamiento de cada uno de los bloques de código que componen el backend de la aplicación, desarrollado utilizando el microframework **Flask** y el conector de **MySQL**.

---

## 1. Importación de Módulos

```python
import os
import mysql.connector
from flask import Flask, jsonify, request
from flask_cors import CORS
```

* **`os`**: Módulo estándar de Python que permite la interacción con el sistema operativo. En este proyecto se utiliza para leer las variables de entorno relativas a las credenciales de la base de datos.
* **`mysql.connector`**: Conector oficial que permite realizar la comunicación, consultas y transacciones con la base de datos MySQL.
* **`Flask`**: Clase principal para instanciar la aplicación y registrar las rutas de la API.
* **`jsonify`**: Función de Flask que serializa objetos de Python (como diccionarios y listas) a formato JSON para ser enviados en las respuestas HTTP.
* **`request`**: Objeto global de Flask que permite acceder a los datos de la petición entrante, tales como parámetros de consulta en la URL (parámetros GET) o el cuerpo JSON de una petición (datos POST).
* **`CORS`**: Extensión de Flask encargada de gestionar el Intercambio de Recursos de Origen Cruzado. Permite que clientes situados en otros puertos o dominios (como un frontend local de JavaScript) consulten los endpoints sin problemas de seguridad en el navegador.

---

## 2. Inicialización de la Aplicación y CORS

```python
app = Flask(__name__)
CORS(app)
```

* Instancia el objeto principal `app` de Flask, que representa la aplicación web backend.
* Envuelve la aplicación en `CORS(app)` para autorizar de forma global la recepción de peticiones desde cualquier origen externo.

---

## 3. Configuración de la Base de Datos (`get_db_config`)

```python
def get_db_config():
    return {
        "host": os.getenv("DB_HOST", "db"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASS", "root"),
        "database": os.getenv("DB_NAME", "bd1"),
    }
```

* **Propósito**: Define los parámetros de conexión necesarios para conectarse al servidor de MySQL.
* **Funcionamiento**: Lee variables de entorno del sistema con `os.getenv`. Si estas variables no están definidas (por ejemplo, al ejecutar en local sin contenedor), utiliza credenciales por defecto (`"db"`, `"root"`, `"bd1"`).

---

## 4. Función de Conexión (`get_db_connection`)

```python
def get_db_connection():
    connection = mysql.connector.connect(**get_db_config())
    connection.row_factory = mysql.connector.cursor_names
    return connection
```

* **Propósito**: Encapsula la creación física de la conexión con el servidor MySQL.
* **Funcionamiento**: Llama a `mysql.connector.connect` pasando el diccionario de configuración expandido mediante `**`. 

---

## 5. Endpoint de Salud (`/health` - GET)

```python
@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200
```

* **Propósito**: Endpoint simple utilizado para monitorización (*health check*).
* **Respuesta**: Retorna un JSON con `{ "status": "ok" }` y el código HTTP `200` para comprobar de manera rápida si el servidor Flask está encendido y respondiendo peticiones.

---

## 6. Endpoint de Prueba de la BD (`/api/test-db` - GET)

```python
@app.get("/api/test-db")
def test_db():
    connection = None
    try:
        connection = mysql.connector.connect(**get_db_config())
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return jsonify({
            "status": "success",
            "message": "Conexion con MySQL establecida correctamente",
        }), 200
    except mysql.connector.Error as exc:
        return jsonify({
            "status": "error",
            "message": f"Error al conectar con MySQL: {exc}",
        }), 500
    finally:
        if connection and connection.is_connected():
            connection.close()
```

* **Propósito**: Verificar en tiempo real la conectividad real entre el backend y MySQL.
* **Funcionamiento**:
  1. Intenta abrir una conexión.
  2. Ejecuta una consulta SQL elemental (`SELECT 1`) a través de un cursor temporal.
  3. Si la base de datos responde correctamente, devuelve un código `200` con éxito.
  4. Si ocurre un error de base de datos (`mysql.connector.Error`), captura la excepción e informa el detalle del error con código `500`.
  5. **Garantía**: El bloque `finally` asegura que la conexión sea cerrada de forma segura si fue establecida con éxito, previniendo fugas de conexión.

---

## 7. Endpoint para Listar Hoteles (`/api/hoteles` - GET)

```python
@app.get("/api/hoteles")
def listar_hoteles():
    connection = None
    try:
        connection = mysql.connector.connect(**get_db_config())
        cursor = connection.cursor(dictionary=True)

        ciudad = request.args.get("ciudad")
        fecha_entrada = request.args.get("fecha_entrada")
        fecha_salida = request.args.get("fecha_salida")
        habitaciones = request.args.get("habitaciones", type=int)

        query = """
            SELECT h.id, h.nombre, h.ciudad, h.descripcion, h.precio_noche,
                   h.numero_habitaciones, h.imagen_principal, h.imagen_secundaria
            FROM hoteles h
        """
        conditions = []
        params = []

        if ciudad:
            conditions.append("h.ciudad = %s")
            params.append(ciudad)

        if fecha_entrada and fecha_salida:
            subquery = """
                (SELECT COALESCE(SUM(r.numero_habitaciones), 0)
                 FROM reservas r
                 WHERE r.hotel_id = h.id
                   AND r.fecha_entrada < %s
                   AND r.fecha_salida > %s)
            """
            conditions.append(
                f"(h.numero_habitaciones - {subquery}) > 0"
            )
            params.extend([fecha_salida, fecha_entrada])

            if habitaciones:
                conditions.append(
                    f"(h.numero_habitaciones - {subquery}) >= %s"
                )
                params.extend([fecha_salida, fecha_entrada, habitaciones])

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        cursor.execute(query, params)
        hoteles = cursor.fetchall()

        for hotel in hoteles:
            hotel["precio_noche"] = float(hotel["precio_noche"])

        if fecha_entrada and fecha_salida:
            for hotel in hoteles:
                cursor.callproc("habitaciones_disponibles", (hotel["id"], fecha_entrada, fecha_salida))
                for result in cursor.stored_results():
                    row = result.fetchone()
                    hotel["habitaciones_disponibles"] = row["disponibles"] if row else 0

        return jsonify(hoteles), 200

    except mysql.connector.Error as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if connection and connection.is_connected():
            connection.close()
```

* **Propósito**: Consulta y retorna una lista de hoteles desde la base de datos, permitiendo búsquedas avanzadas y filtrado en base a su ubicación y disponibilidad de habitaciones en un rango de fechas determinado.
* **Filtros disponibles (Query Parameters)**:
  * **`ciudad`**: Filtra los hoteles por su ubicación exacta.
  * **`fecha_entrada` y `fecha_salida`**: Rango de fechas seleccionado para el viaje. Si se proveen, se descartan los hoteles sin habitaciones disponibles en ese intervalo.
  * **`habitaciones`**: Cantidad de habitaciones que el usuario desea reservar (por defecto se convierte a tipo `int`).

### Explicación detallada del funcionamiento:

#### A. Inicialización y Conexión
```python
connection = mysql.connector.connect(**get_db_config())
cursor = connection.cursor(dictionary=True)
```
Se abre una nueva conexión con la base de datos MySQL y se crea un **cursor de diccionario** (`dictionary=True`). Esto hace que cada fila retornada de las consultas no sea una simple tupla de valores, sino un diccionario estructurado de Python (ej: `{"id": 1, "nombre": "Hotel A", ...}`), lo cual es ideal para serializar directamente a formato JSON.

#### B. Construcción Dinámica de la Consulta SQL (Filtros Ad-hoc)
Para evitar hacer múltiples consultas o traer datos innecesarios a memoria, el código construye la consulta de forma dinámica en base a las variables provistas por la URL:
1. Se define la consulta base sobre la tabla de `hoteles`:
   ```sql
   SELECT h.id, h.nombre, h.ciudad, h.descripcion, h.precio_noche,
          h.numero_habitaciones, h.imagen_principal, h.imagen_secundaria
   FROM hoteles h
   ```
2. Se utilizan dos listas vacías: `conditions` (para agregar fragmentos del filtro `WHERE`) y `params` (para almacenar los valores que se inyectarán de forma segura en la base de datos).
3. **Filtro por ciudad**: Si se provee `ciudad`, se añade la condición `"h.ciudad = %s"` y se añade el valor al arreglo `params`.

#### C. Lógica Compleja de Disponibilidad y Stock (Solapamiento de Fechas)
Si el usuario especifica `fecha_entrada` y `fecha_salida`, el backend realiza un filtro inteligente para descartar hoteles agotados en dicho rango.
Esto se logra calculando una **subconsulta** SQL (`subquery`) que calcula la suma de habitaciones actualmente reservadas en ese lapso de tiempo para cada hotel:

```sql
(SELECT COALESCE(SUM(r.numero_habitaciones), 0)
 FROM reservas r
 WHERE r.hotel_id = h.id
   AND r.fecha_entrada < %s
   AND r.fecha_salida > %s)
```

> [!IMPORTANT]
> **Fórmula de Solapamiento de Fechas**: Dos rangos de fechas (`[A_entrada, A_salida]` y `[B_entrada, B_salida]`) se solapan si y solo si:
> $$\text{A\_entrada} < \text{B\_salida} \quad \text{y} \quad \text{A\_salida} > \text{B\_entrada}$$
> En el código, se evalúa si alguna reserva existente se cruza con las fechas deseadas. 
> * `COALESCE(SUM(...), 0)` garantiza que si no hay reservas previas en esas fechas, la suma devuelva `0` en lugar de `NULL`.

* **Stock restante**: Al número total de habitaciones del hotel (`h.numero_habitaciones`) se le resta el valor devuelto por la subconsulta.
* Si el stock de habitaciones disponibles es menor o igual a cero, el hotel se excluye de los resultados (`(h.numero_habitaciones - subquery) > 0`).
* Si además el usuario solicitó un número de habitaciones específico (`habitaciones`), se filtra para que el stock restante sea mayor o igual a ese mínimo (`>= %s`).

#### D. Ejecución e Inyección Segura (Evitar SQL Injection)
Una vez añadidas las condiciones dinámicas:
```python
if conditions:
    query += " WHERE " + " AND ".join(conditions)
cursor.execute(query, params)
```
Se concatenan todos los filtros con un operador `AND`. El uso de `%s` como marcador de posición junto con el segundo argumento `params` asegura que el controlador de base de datos escape todos los valores provistos por el usuario, anulando cualquier posibilidad de ataque por inyección SQL.

#### E. Formateo y Tipado para JSON
```python
for hotel in hoteles:
    hotel["precio_noche"] = float(hotel["precio_noche"])
```
La columna `precio_noche` está configurada como un campo decimal de alta precisión en MySQL (`DECIMAL`). Python recupera estos valores como objetos de clase `Decimal`. Como el formato JSON no soporta la serialización nativa de objetos `Decimal`, el bucle los transforma explícitamente a tipo coma flotante (`float`) para prevenir errores de serialización.

#### F. Procedimiento Almacenado en Tiempo Real (`habitaciones_disponibles`)
Si se consultaron fechas, el backend ejecuta un procedimiento almacenado en MySQL para calcular con exactitud cuántas habitaciones libres le restan a cada uno de los hoteles filtrados:
```python
cursor.callproc("habitaciones_disponibles", (hotel["id"], fecha_entrada, fecha_salida))
for result in cursor.stored_results():
    row = result.fetchone()
    hotel["habitaciones_disponibles"] = row["disponibles"] if row else 0
```
* `cursor.callproc()` invoca el procedimiento en el servidor MySQL pasándole como argumentos el ID del hotel y el rango de fechas.
* `cursor.stored_results()` extrae el conjunto de resultados generados por el procedimiento. El valor de habitaciones restantes se inyecta directamente como un atributo adicional llamado `habitaciones_disponibles` en cada diccionario de hotel devuelto al frontend.

#### G. Liberación de Recursos Garantizada (`finally`)
```python
finally:
    if connection and connection.is_connected():
        connection.close()
```
El bloque `finally` es crucial en la arquitectura web. Se ejecuta de forma obligatoria tanto si la consulta se completó con éxito como si se lanzó una excepción por fallo de base de datos. De esta forma, nos aseguramos de cerrar siempre la conexión activa, evitando colapsar el pool de conexiones de MySQL por conexiones huérfanas o inactivas.

---

## 8. Endpoint de Detalle de Hotel (`/api/hoteles/<int:hotel_id>` - GET)

```python
@app.get("/api/hoteles/<int:hotel_id>")
def detalle_hotel(hotel_id):
    connection = None
    try:
        connection = mysql.connector.connect(**get_db_config())
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT * FROM hoteles WHERE id = %s", (hotel_id,))
        hotel = cursor.fetchone()

        if not hotel:
            return jsonify({"status": "error", "message": "Hotel no encontrado"}), 404

        hotel["precio_noche"] = float(hotel["precio_noche"])

        return jsonify(hotel), 200

    except mysql.connector.Error as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if connection and connection.is_connected():
            connection.close()
```

* **Propósito**: Obtener la ficha completa de un hotel individual mediante su clave primaria (`id`).

### Explicación detallada del funcionamiento:

#### A. Parámetro Tipado en la Ruta (`<int:hotel_id>`)
Flask permite el uso de **convertidores de tipo** directamente en la ruta de las URLs:
* `<int:hotel_id>` le indica a Flask que la variable capturada de la URL (`hotel_id`) debe ser un entero.
* Si el cliente intenta acceder a una URL no válida como `/api/hoteles/madrid` (donde `"madrid"` no es un número entero), Flask intercepta la petición y devuelve directamente un error **404 Not Found**, protegiendo el backend de ejecutar consultas inútiles con tipos incorrectos.

#### B. Ejecución con Monotupla y Prevención de SQL Injection
```python
cursor.execute("SELECT * FROM hoteles WHERE id = %s", (hotel_id,))
```
* **Uso del `%s`**: Se utiliza como marcador de posición para inyectar de manera segura el ID del hotel en la consulta SQL básica.
* **La coma final `(hotel_id,)`**: En Python, un elemento rodeado por paréntesis `(hotel_id)` es evaluado simplemente como el valor del elemento aislado. Para declarar explícitamente una **tupla** de un solo elemento (monotupla) que requiere la interfaz del conector de MySQL, es obligatorio colocar una coma al final antes de cerrar el paréntesis.

#### C. Búsqueda de Fila Única (`cursor.fetchone()`)
A diferencia de `cursor.fetchall()`, que retorna una lista con todos los registros coincidentes:
* `cursor.fetchone()` devuelve únicamente el **primer registro** que satisfaga la condición de la consulta.
* Dado que `id` es la clave primaria (Primary Key) en la tabla `hoteles`, la consulta devolverá como máximo un único resultado. 
* Si se encuentra el registro, retorna el diccionario correspondiente al hotel; si no existe ningún hotel con ese ID, el cursor devuelve **`None`**.

#### D. Validación y Control del Error 404 (Recurso no Encontrado)
```python
if not hotel:
    return jsonify({"status": "error", "message": "Hotel no encontrado"}), 404
```
* Se verifica si la variable `hotel` es evaluada como falsa (lo cual ocurre cuando es `None`).
* En tal caso, se detiene el flujo normal de la función y se le envía al cliente una respuesta estructurada en JSON (`{"status": "error", ...}`) junto con el código de estado HTTP **`404`** (estándar para recursos inexistentes).

#### E. Tipado Decimal y Respuesta Exitosa
Si la verificación anterior pasa correctamente (el hotel existe):
1. **Casteo de decimales**: De nuevo, se convierte el precio decimal recuperado a tipo flotante (`float`) para no provocar fallos al serializar.
2. **Retorno**: Envía los datos del hotel envueltos por `jsonify` con el código **`200 OK`**.

#### F. Cierre Seguro de Conexión (`finally`)
Al igual que en los demás endpoints, el bloque `finally` asegura la desconexión total del servidor de base de datos bajo cualquier circunstancia, garantizando la salud y escalabilidad de la API.

---

## 9. Endpoint de Creación de Reservas (`/api/reservas` - POST)

```python
@app.post("/api/reservas")
def crear_reserva():
    ...
```

* **Propósito**: Registrar una reserva a nombre de un cliente en la base de datos.
* **Flujo**:
  1. Obtiene y lee los datos estructurados en formato JSON desde el cuerpo de la petición.
  2. Valida que todos los campos requeridos (`hotel_id`, `nombre_cliente`, fechas y número de habitaciones a reservar) estén presentes.
  3. Comprueba el total de habitaciones que posee el hotel.
  4. Suma las habitaciones actualmente ocupadas en el rango de fechas solicitado en la tabla de reservas.
  5. Calcula el stock disponible. Si el cliente solicita reservar más habitaciones de las disponibles, interrumpe el flujo y devuelve un error de conflicto (`409 Conflict`).
  6. Si hay espacio suficiente, inserta la reserva en la tabla `reservas`, efectúa un `commit` para confirmar los cambios en la base de datos y retorna una confirmación con código HTTP `201` (Creado) indicando el identificador (`reserva_id`) asignado.

---

## 10. Endpoint para Obtener Ciudades (`/api/ciudades` - GET)

```python
@app.get("/api/ciudades")
def obtener_ciudades():
    ...
```

* **Propósito**: Listar de forma rápida todas las ciudades diferentes que cuentan con al menos un hotel.
* **Funcionamiento**: Ejecuta una consulta SQL con `SELECT DISTINCT ciudad` ordenada de forma ascendente. Es ideal para poblar dinámicamente selectores o desplegables de búsqueda en la interfaz de usuario.

---

## 11. Bloque de Entrada Principal (`if __name__ == "__main__":`)

```python
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
```

* **Propósito**: Lanzar el servidor web de desarrollo cuando se arranca el script de forma directa.
* **Configuración**:
  * **`host="0.0.0.0"`**: Configura el servidor para escuchar peticiones entrantes en cualquier interfaz de red (haciéndolo accesible externamente desde redes locales, contenedores de Docker o máquinas virtuales).
  * **`port=5000`**: Define el puerto de red clásico por defecto de Flask.
  * **`debug=False`**: Desactiva el modo de depuración en caliente para entornos donde se requiera mayor estabilidad y menor sobrecarga.
