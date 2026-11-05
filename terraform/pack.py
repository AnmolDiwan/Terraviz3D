import os
import zipfile

zip_filename = "build.zip"

if os.path.exists(zip_filename):
    os.remove(zip_filename)

print("Packing backend directory with UNIX forward slashes...")

with zipfile.ZipFile(zip_filename, "w", zipfile.ZIP_DEFLATED) as z:
    if os.path.exists("buildspec.yml"):
        z.write("buildspec.yml", "buildspec.yml")
    for root, dirs, files in os.walk("backend"):
        if "node_modules" in root:
            continue
        for file in files:
            if file.startswith(".env"):
                continue
            full_path = os.path.join(root, file)
            # Force standard Unix forward slashes for Linux compatibility
            arcname = full_path.replace("\\", "/")
            z.write(full_path, arcname)

size_mb = os.path.getsize(zip_filename) / (1024 * 1024)
print(f"Created {zip_filename} ({size_mb:.2f} MB)")
