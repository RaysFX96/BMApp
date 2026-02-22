from PIL import Image
import os

# Icon sizes for Android
sizes = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
}

# Base directory
base_dir = r'C:\Users\Administrator\Desktop\App Moto'
source_icon = os.path.join(base_dir, 'icon_temp', 'biker_manager_icon.png')
res_dir = os.path.join(base_dir, 'android', 'app', 'src', 'main', 'res')

# Load the source image
try:
    img = Image.open(source_icon)
    print(f"Loaded icon: {img.size}")
    
    # Generate icons for each density
    for density, size in sizes.items():
        # Resize image
        resized = img.resize((size, size), Image.Resampling.LANCZOS)
        
        # Save to mipmap directory
        output_dir = os.path.join(res_dir, f'mipmap-{density}')
        os.makedirs(output_dir, exist_ok=True)
        
        # Save both ic_launcher.png and ic_launcher_round.png
        output_path = os.path.join(output_dir, 'ic_launcher.png')
        resized.save(output_path, 'PNG')
        print(f"Created {density}: {output_path}")
        
        output_path_round = os.path.join(output_dir, 'ic_launcher_round.png')
        resized.save(output_path_round, 'PNG')
        print(f"Created {density} round: {output_path_round}")
    
    print("\nAll icons generated successfully!")
    
except Exception as e:
    print(f"Error: {e}")
