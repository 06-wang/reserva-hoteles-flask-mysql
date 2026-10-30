import os

import mysql.connector
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def get_db_config():
    return {
        "host": os.getenv("DB_HOST", "db"),
        "user": os.getenv("DB_USER", "root"),
        "password": os.getenv("DB_PASS", "root"),
        "database": os.getenv("DB_NAME", "bd1"),
    }


def get_db_connection():
    connection = mysql.connector.connect(**get_db_config())
    connection.row_factory = mysql.connector.cursor_names
    return connection


@app.get("/health")
def health():
    return jsonify({"status": "ok"}), 200


@app.get("/api/test-db")
def test_db():
    connection = None

    try:
        connection = mysql.connector.connect(**get_db_config())
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()

        return jsonify(
            {
                "status": "success",
                "message": "Conexion con MySQL establecida correctamente",
            }
        ), 200
    except mysql.connector.Error as exc:
        return jsonify(
            {
                "status": "error",
                "message": f"Error al conectar con MySQL: {exc}",
            }
        ), 500
    finally:
        if connection and connection.is_connected():
            connection.close()


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


@app.post("/api/reservas")
def crear_reserva():
    connection = None
    try:
        data = request.get_json()

        hotel_id = data.get("hotel_id")
        nombre_cliente = data.get("nombre_cliente")
        fecha_entrada = data.get("fecha_entrada")
        fecha_salida = data.get("fecha_salida")
        numero_habitaciones = data.get("numero_habitaciones")

        if not all([hotel_id, nombre_cliente, fecha_entrada, fecha_salida, numero_habitaciones]):
            return jsonify({"status": "error", "message": "Faltan campos requeridos"}), 400

        connection = mysql.connector.connect(**get_db_config())
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT numero_habitaciones FROM hoteles WHERE id = %s", (hotel_id,))
        hotel = cursor.fetchone()
        if not hotel:
            return jsonify({"status": "error", "message": "Hotel no encontrado"}), 404

        cursor.execute(
            """
            SELECT COALESCE(SUM(r.numero_habitaciones), 0) AS reservadas
            FROM reservas r
            WHERE r.hotel_id = %s
              AND r.fecha_entrada < %s
              AND r.fecha_salida > %s
            """,
            (hotel_id, fecha_salida, fecha_entrada),
        )
        resultado = cursor.fetchone()
        reservadas = resultado["reservadas"]
        disponibles = hotel["numero_habitaciones"] - reservadas

        if numero_habitaciones > disponibles:
            return jsonify({
                "status": "error",
                "message": f"Solo quedan {disponibles} habitaciones disponibles"
            }), 409

        cursor.execute(
            """
            INSERT INTO reservas (hotel_id, nombre_cliente, fecha_entrada, fecha_salida, numero_habitaciones)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (hotel_id, nombre_cliente, fecha_entrada, fecha_salida, numero_habitaciones),
        )
        connection.commit()

        return jsonify({
            "status": "success",
            "message": "Reserva creada correctamente",
            "reserva_id": cursor.lastrowid
        }), 201

    except mysql.connector.Error as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if connection and connection.is_connected():
            connection.close()


@app.get("/api/ciudades")
def obtener_ciudades():
    connection = None
    try:
        connection = mysql.connector.connect(**get_db_config())
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT DISTINCT ciudad FROM hoteles ORDER BY ciudad")
        ciudades = [row["ciudad"] for row in cursor.fetchall()]

        return jsonify(ciudades), 200

    except mysql.connector.Error as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if connection and connection.is_connected():
            connection.close()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
