# Este Dockerfile define cómo construir la imagen del backend y cómo ejecutar la aplicación dentro de un contenedor.
# Usa una imagen base ligera de Python 3.11 para construir el contenedor.
FROM python:3.11-slim

# Define /app como directorio de trabajo dentro del contenedor.
WORKDIR /app

# Copia el archivo de dependencias al directorio de trabajo actual.
COPY requirements.txt .

# Instala las dependencias de Python indicadas en requirements.txt sin guardar caché.
RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto del código fuente del proyecto al contenedor.
COPY . .

# Indica el comando que se ejecutará al iniciar el contenedor.
CMD ["python", "main.py"]
