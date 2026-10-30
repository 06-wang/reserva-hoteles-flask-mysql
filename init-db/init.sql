CREATE TABLE IF NOT EXISTS hoteles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100),
    ciudad VARCHAR(50),
    descripcion TEXT,
    precio_noche DECIMAL(10,2),
    numero_habitaciones INT,
    imagen_principal VARCHAR(255),
    imagen_secundaria VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT,
    nombre_cliente VARCHAR(100),
    fecha_entrada DATE,
    fecha_salida DATE,
    numero_habitaciones INT,
    FOREIGN KEY (hotel_id) REFERENCES hoteles(id)
);

INSERT INTO hoteles (nombre, ciudad, descripcion, precio_noche, numero_habitaciones, imagen_principal, imagen_secundaria) VALUES
('Hotel Playa Dorada', 'Malaga', 'Hotel frente al mar con piscina infinity y spa. Desayuno buffet incluido.', 120.00, 50, 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800', 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800'),
('Gran Hotel Central', 'Madrid', 'Hotel de lujo en pleno centro de Madrid. Cerca de museos y zonas comerciales.', 180.00, 80, 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800', 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800'),
('Hotel Montana Verde', 'Granada', 'Hotel rural con vistas a Sierra Nevada. Ideal paraSenderismo y descanso.', 85.00, 30, 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800'),
('Hotel Torres del Puerto', 'Barcelona', 'Hotel moderno junto al puerto de Barcelona. Habitaciones con vista al mar.', 150.00, 60, 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800', 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800'),
('Casa Rural El Encinar', 'Sevilla', 'Casa rural tradicional sevillana con patio interior y piscina.', 70.00, 20, 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800', 'https://images.unsplash.com/photo-1549294413-26f195200c16?w=800'),
('Hotel Palacio Real', 'Valencia', 'Hotel con encanto en edificio historico rehabilitado. Cerca de la Ciudad de las Artes.', 135.00, 45, 'https://images.unsplash.com/photo-1551632436-cbf8dd35adfa?w=800', 'https://images.unsplash.com/photo-1587213811864-46e59f6873b1?w=800'),
('Apartamentos Sol y Arena', 'Malaga', 'Apartamentos equipados a 50 metros de la playa. Cocina completa incluida.', 95.00, 35, 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800', 'https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800'),
('Hotel Vista al Mar', 'Barcelona', 'Hotel boutique con terraza panoramica y restaurante gourmet.', 200.00, 25, 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800', 'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800');

CREATE TABLE IF NOT EXISTS auditoria_reservas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hotel_id INT,
    reserva_id INT,
    fecha_hora DATETIME,
    accion ENUM('INSERT', 'UPDATE', 'DELETE')
);

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS habitaciones_disponibles(
    IN p_hotel_id INT,
    IN p_fecha_entrada DATE,
    IN p_fecha_salida DATE
)
BEGIN
    SELECT h.numero_habitaciones - COALESCE(SUM(r.numero_habitaciones), 0) AS disponibles
    FROM hoteles h
    LEFT JOIN reservas r ON r.hotel_id = h.id
        AND r.fecha_entrada < p_fecha_salida
        AND r.fecha_salida > p_fecha_entrada
    WHERE h.id = p_hotel_id
    GROUP BY h.id;
END //

CREATE TRIGGER trg_auditoria_reserva_insert
AFTER INSERT ON reservas
FOR EACH ROW
BEGIN
    INSERT INTO auditoria_reservas (hotel_id, reserva_id, fecha_hora, accion)
    VALUES (NEW.hotel_id, NEW.id, NOW(), 'INSERT');
END //

CREATE TRIGGER trg_auditoria_reserva_update
AFTER UPDATE ON reservas
FOR EACH ROW
BEGIN
    INSERT INTO auditoria_reservas (hotel_id, reserva_id, fecha_hora, accion)
    VALUES (NEW.hotel_id, NEW.id, NOW(), 'UPDATE');
END //

CREATE TRIGGER trg_auditoria_reserva_delete
AFTER DELETE ON reservas
FOR EACH ROW
BEGIN
    INSERT INTO auditoria_reservas (hotel_id, reserva_id, fecha_hora, accion)
    VALUES (OLD.hotel_id, OLD.id, NOW(), 'DELETE');
END //

DELIMITER ;
