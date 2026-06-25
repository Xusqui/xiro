#!/bin/bash
clear
# --- Configuración ---
# Directorio de inicio (punto actual donde se ejecuta el script)
TARGET_DIR="."
# Nombre del objetivo a eliminar
FOLDER_NAME="@eaDir"
FILE_PATTERN="._*.*"

delete_eadir_folders() {
	echo "Iniciando la búsqueda y eliminación de carpetas $FOLDER_NAME en: $TARGET_DIR"
	find "$TARGET_DIR" -type d -name "$FOLDER_NAME" -exec rm -rf {} +
	echo "Limpieza de carpetas $FOLDER_NAME completada."
}

delete_dot_underscore_files() {
	echo "Iniciando la búsqueda y eliminación de archivos $FILE_PATTERN en: $TARGET_DIR"
	find "$TARGET_DIR" -type f -name "$FILE_PATTERN" -exec rm -f {} +
	echo "Limpieza de archivos $FILE_PATTERN completada."
}

# 1. Buscar y listar (Paso de verificación opcional)
# Si quieres ver qué se borraría sin borrar nada, descomenta la siguiente línea:
# find "$TARGET_DIR" -type d -name "$FOLDER_NAME"

# Si quieres ver qué archivos ._*.* se borrarían sin borrar nada, descomenta la siguiente línea:
find "$TARGET_DIR" -type f -name "$FILE_PATTERN"

# 2. Comando de eliminación recursiva
# -type d: busca solo directorios
# -name: busca el nombre exacto
# -exec rm -rf: ejecuta el borrado recursivo y forzado sobre cada resultado
delete_eadir_folders
delete_dot_underscore_files

echo "Limpieza completada con éxito."
