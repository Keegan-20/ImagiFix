//creating variables
const fileInput = document.querySelector("#imageFileInput");
const canvas = document.querySelector("#canvas");
const canvasContext = canvas.getContext("2d");
const brightnessInput = document.getElementById('brightness');//user inputs
const saturationInput = document.getElementById('saturation');
const contrastInput = document.getElementById('contrast');
const blurInput = document.getElementById('blur');
const inversionInput = document.getElementById('inversion');
const opacityInput = document.getElementById('opacity');
const cropButton = document.getElementById('cropButton'); //crop feature
const cropArea = document.querySelector("#cropArea");
const tempCanvas = document.createElement('canvas');
const tempContext = tempCanvas.getContext('2d');
const errorMessage = document.getElementById("error-message");

//range input user value
const brightnessRangeValue = document.getElementById('brightnessValue');
const saturationRangeValue = document.getElementById('saturationValue');
const contrastRangeValue = document.getElementById('contrastValue');
const blurRangeValue = document.getElementById('blurValue');
const inversionRangeValue = document.getElementById('inversionValue');
const opacityRangeValue = document.getElementById('opacityValue');
let outputTags = document.getElementsByTagName("output");
let inputTags = document.getElementsByTagName("input");

const settings = {}; // this empty object  will store all the user inputs for brightness,blur ,saturation etc.
let image = null; //will store the currently selected image by default when page load  the user has not selected any image so its deafult value is  Null
let rotationAngle = 0;
let flipHorizontal = false;
let flipVertical = false;
//crop feature variables
let startX, startY, endX, endY;
let isCropMode = false; // Flag to indicate if the crop mode is enabled
let renderWidth, renderHeight, offsetX, offsetY;

//reseting the filters
function resetSettings() {
  const filters = ['brightness', 'saturation', 'contrast', 'blur', 'inversion', 'opacity'];
  filters.forEach(filter => {
    if (filter === 'blur' || filter === 'inversion') {
      settings[filter] = '0'; // Reset the blur and inversion filters to '0'
    }
     else {
      settings[filter] = '100'; // Reset other filters to '100'
    }
  });
    //to restore to default values when we select a new image
    brightnessInput.value = settings.brightness;
    saturationInput.value = settings.saturation;
    contrastInput.value = settings.contrast;
    blurInput.value = settings.blur;
    inversionInput.value = settings.inversion;
    opacityInput.value = settings.opacity;

    // Update range value display to default
  brightnessRangeValue.textContent = settings.brightness;
  saturationRangeValue.textContent = settings.saturation;
  contrastRangeValue.textContent = settings.contrast;
  blurRangeValue.textContent = settings.blur;
  inversionRangeValue.textContent = settings.inversion;
}
 
// displaying range input values according to user input
brightnessInput.addEventListener('input', function () {
    brightnessRangeValue.textContent = brightnessInput.value;
});
saturationInput.addEventListener('input', function () {
    saturationRangeValue.textContent = saturationInput.value;
});
contrastInput.addEventListener('input', function () {
    contrastRangeValue.textContent = contrastInput.value;
});
blurInput.addEventListener('input', function () {
    blurRangeValue.textContent = blurInput.value;
});
inversionInput.addEventListener('input', function () {
    inversionRangeValue.textContent = inversionInput.value;
});

//opacity filter to keep value between  0 to 1
opacityInput.addEventListener("input", function () {
    let opacity = opacityInput.value / 100;
    opacityRangeValue.textContent = opacity;
});

// Iitial image placeholder preview
const imgPlaceholder = new Image();
imgPlaceholder.onload = function () {
    canvasContext.drawImage(imgPlaceholder, 0, 0, canvas.width, canvas.height);
};
imgPlaceholder.src = "./img/image-placeholder.svg";


//updating the settings
function updateSetting(key, value) {
    if (!image) {
        displayErrorMessage();

        for (let i = 0; i < outputTags.length; i++) {
            outputTags[i].textContent = "";
            outputTags[i].disabled = true;
        }


        for (let i = 0; i < inputTags.length; i++) {
            if (inputTags[i].type === "range") {
                inputTags[i].disabled = true;
            }
        }

        return;
    }
    settings[key] = value;

    renderImage();
}


//displaying an error message
function displayErrorMessage() {
    errorMessage.textContent = "Please select an image to begin editing!!";
}

// Clear any existing error message after selecting the image
fileInput.addEventListener("change", () => {
    errorMessage.textContent = "";
})

// Rendering the image on the canvas
function renderImage() {
    if (!image) {
      return displayErrorMessage();
    }
  
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
  
    const imageAspectRatio = image.width / image.height;
    const canvasAspectRatio = canvasWidth / canvasHeight;
  
  
    if (imageAspectRatio > canvasAspectRatio) {
      renderWidth = canvasWidth;
      renderHeight = renderWidth / imageAspectRatio;
      offsetX = 0;
      offsetY = (canvasHeight - renderHeight) / 2;
    } else {
      renderHeight = canvasHeight;
      renderWidth = renderHeight * imageAspectRatio;
      offsetY = 0;
      offsetX = (canvasWidth - renderWidth) / 2;
    }
  
    canvasContext.clearRect(0, 0, canvasWidth, canvasHeight);
    canvasContext.save();
    canvasContext.translate(canvasWidth / 2, canvasHeight / 2);
    canvasContext.rotate((rotationAngle * Math.PI) / 180);
    
    // Flip image feature
    if (flipHorizontal) {
      canvasContext.scale(-1, 1); // Width turned to opposite value
    } 
    if (flipVertical) {
      canvasContext.scale(1, -1); // Height turned to opposite value
    }
  
    // Apply crop area
    if (
      startX !== undefined &&
      startY !== undefined &&
      endX !== undefined &&
      endY !== undefined
    ) {
      const width = endX - startX;
      const height = endY - startY;
      canvasContext.drawImage(
        image,
        startX,
        startY,
        width,
        height,
        -renderWidth / 2,
        -renderHeight / 2,
        renderWidth,
        renderHeight
      );
    } else {
      canvasContext.drawImage(
        image,
        -renderWidth / 2,
        -renderHeight / 2,
        renderWidth,
        renderHeight
      );
    }
    
    canvasContext.restore();
  
    // Apply text overlay
    canvasContext.fillStyle = textOverlay.color;
    canvasContext.font = `${textOverlay.size}px Arial`;
    canvasContext.fillText(textOverlay.content, textOverlay.x, textOverlay.y);
    canvasContext.filter = generateFilter();
    canvasContext.drawImage(canvas, 0, 0, canvasWidth, canvasHeight);
  }
  
  //generating filters
function generateFilter() {
    const {
        brightness, saturation,
        contrast, blur,
        inversion, opacity
    } = settings;

    return `brightness(${brightness}% ) saturate(${saturation}%) contrast(${contrast}%) blur(${blur}px) invert(${inversion}%) opacity(${opacity}%)`;
}

//updating and saving the values given by the user
brightnessInput.addEventListener("input", () => updateSetting("brightness", brightnessInput.value));
saturationInput.addEventListener("input", () => updateSetting("saturation", saturationInput.value));
contrastInput.addEventListener("input", () => updateSetting("contrast", contrastInput.value));
blurInput.addEventListener("input", () => updateSetting("blur", blurInput.value));
inversionInput.addEventListener("input", () => updateSetting("inversion", inversionInput.value));
opacityInput.addEventListener("input", () => updateSetting("opacity", opacityInput.value));

//selection of a file using fileInput element
fileInput.addEventListener("change", () => {
    image = new Image();
    image.addEventListener("load", () => {

        resetSettings();
        resetAllFilters();
        renderImage();

        // Image is selected, enable the filters
        for (let i = 0; i < outputTags.length; i++) {
            outputTags[i].disabled = false;
        }

        for (let i = 0; i < inputTags.length; i++) {
            inputTags[i].disabled = false;
        }

    });
    image.src = URL.createObjectURL(fileInput.files[0]);
});

resetSettings();

//rotate Image feature
const rotateLeftButton = document.getElementById('rotateLeftButton');
const rotateRightButton = document.getElementById('rotateRightButton');

function rotateImage(angle) {
    if (!image) {
        return displayErrorMessage();
    }
    rotationAngle += angle;

    //checking if rotatiom angle is within 0 to 359
    if (rotationAngle >= 360) {
        rotationAngle %= 360;
    }
    else if (rotationAngle < 0) {
        rotationAngle = (rotationAngle % 360) + 360;
    }

    tempCanvas.width = Math.max(image.width, image.height);
    tempCanvas.height = Math.max(image.width, image.height);

    tempContext.save();
    tempContext.translate(tempCanvas.width / 2, tempCanvas.height / 2); //rendering context to the center of the canvas
    tempContext.rotate((rotationAngle * Math.PI) / 180); // The angle is converted from degrees to radians

    tempContext.drawImage(
        image,
        -image.width / 2,
        -image.height / 2
    );
    tempContext.restore();
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = tempCanvas.width;
    canvas.height = tempCanvas.height;
    canvasContext.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
    renderImage();
}
rotateLeftButton.addEventListener('click', () => rotateImage(-90));
rotateRightButton.addEventListener('click', () => rotateImage(90));


//Flip Image feature
const flipHorizontalButton = document.getElementById("flipHorizontal");
flipHorizontalButton.addEventListener("click", () => {
    flipHorizontal = !flipHorizontal;
    renderImage();
});

// Flip Vertical button click event
const flipVerticalButton = document.getElementById("flipVertical");
flipVerticalButton.addEventListener("click", () => {
    flipVertical = !flipVertical;
    renderImage();
});

       // Add Text Feature
const textOverlayButton = document.getElementById("textOverlayButton");
const textOverlayOptions = document.getElementById("textOverlayOptions");
const textSizeInput = document.getElementById("textSize");
const textSizeValue = document.getElementById("textSizeValue");
const addTextButton = document.getElementById("addTextButton");

// Toggle the add text icon
textOverlayButton.addEventListener("click", () => {
    textOverlayButton.classList.toggle("active");
});

closeButton.addEventListener("click", () => {
    textOverlayButton.classList.remove("active");
})

   // Update text size value
textSizeInput.addEventListener("input", () => {
    textSizeValue.textContent = textSizeInput.value;
});

// Global variable declaration
var textOverlay = {
    content: "",
    color: "#000000",
    size: 12,
    x: 0,
    y: 0
  };
  
  
  // Function to update text overlay and trigger rendering
  function drawTextOverlay(content, color, size, x, y) {
    textOverlay.content = content;
    textOverlay.color = color;
    textOverlay.size = size;
    textOverlay.x = x;
    textOverlay.y = y;
    renderImage();
  }
  
  addTextButton.addEventListener("click", () => {
    const textContent = document.getElementById("textContent").value;
    const textColor = document.getElementById("textColor").value;
    const textSize = parseInt(textSizeInput.value);
  
      //selecting co-ordinates depending on user click
      canvas.addEventListener('click', function (event) {
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
     drawTextOverlay(textContent, textColor, textSize, x, y);
    });
  });
 
                //Crop Image Feature
// Function to handle mouse down event
function handleMouseDown(event) {
  if (isCropMode) {
    const rect = canvas.getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
  }
}

// Function to handle mouse move event
function handleMouseMove(event) {
  if (isCropMode && startX !== undefined && startY !== undefined) {
    const rect = canvas.getBoundingClientRect();
    endX = event.clientX - rect.left;
    endY = event.clientY - rect.top;
    drawCrosshair(startX, startY, endX, endY);
    
  }
}

// Function to handle mouse up event
function handleMouseUp() {
  if (isCropMode && startX !== undefined && startY !== undefined && endX !== undefined && endY !== undefined) {
    cropImage(startX, startY, endX, endY);
    startX = startY = endX = endY = undefined;
    canvas.style.cursor = 'crosshair';
  }
}

// Function to draw the crop area rectangle based on userclick
function drawCrosshair(startX, startY, endX, endY) {
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    canvasContext.drawImage(image, 0, 0);
    canvasContext.beginPath();
    canvasContext.moveTo(startX, startY);
    canvasContext.lineTo(endX, startY);
    canvasContext.lineTo(endX, endY);
    canvasContext.lineTo(startX, endY);
    canvasContext.closePath();
    canvasContext.strokeStyle = 'blue';
    canvasContext.lineWidth = 1;
    canvasContext.stroke();
    canvasContext.fillStyle = 'rgba(0, 0, 255, 0.2)';
    canvasContext.fillRect(startX, startY, endX - startX, endY - startY);
  }
  
  
// Function to crop the image
function cropImage(startX, startY, endX, endY,) {

    let tempCanvas = document.createElement('canvas');
    let tempContext = tempCanvas.getContext('2d');
    let width = endX - startX;
    let height = endY - startY;
  
    tempCanvas.width = width;
    tempCanvas.height = height;

    // Apply transformations and filters to the temporary canvas
    tempContext.save();
    tempContext.translate(tempCanvas.width / 2, tempCanvas.height / 2);
    tempContext.rotate((rotationAngle * Math.PI) / 180);
    
    if (flipHorizontal) {
      tempContext.scale(-1, 1);
    }
    if (flipVertical) {
      tempContext.scale(1, -1);
    }
    
    tempContext.drawImage(
      image,
      startX, startY, width, height,
      -width / 2, -height / 2, width, height
    );
    tempContext.restore();
    tempContext.filter = generateFilter();
    tempContext.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
  
    // Convert the resulting image data to a data URL and create a new image
    let croppedImage = new Image();
    croppedImage.onload = function() {
      resetSettings();
      renderImage();
    };
    croppedImage.src = tempCanvas.toDataURL();
  
    // Update the image variable with the cropped image
    image = croppedImage;
  }
  
  // Event listener for crop button click
cropButton.addEventListener('click', function() {
  isCropMode = !isCropMode; // Toggle the value of isCropMode
  if (isCropMode) {
    cropButton.textContent = "Save Crop";
    canvas.style.cursor = 'crosshair';
  }
else {
    cropButton.textContent = "Crop";
    canvas.style.cursor = 'auto';
    startX = startY = endX = endY = undefined; // Reset the crop area
    renderImage();
  }
});

// Add event listeners for mouse events
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);

// Saving the Image
const saveButton = document.getElementById("saveButton");
saveButton.addEventListener("click", saveImage);

function saveImage() {
if (!image) {
displayErrorMessage();
return;
}

const saveCanvas = document.createElement("canvas");
const saveContext = saveCanvas.getContext("2d");
saveCanvas.width = canvas.width;
saveCanvas.height = canvas.height;
saveContext.save();
saveContext.translate(saveCanvas.width / 2, saveCanvas.height / 2);
saveContext.rotate((rotationAngle * Math.PI) / 180);

if (flipHorizontal) {
saveContext.scale(-1, 1);

}
if (flipVertical) {
saveContext.scale(1, -1);
}
saveContext.filter = generateFilter();

saveContext.drawImage(
image,
-renderWidth / 2,
-renderHeight / 2,
renderWidth,
renderHeight
);
saveContext.restore();

// Draw text overlay
saveContext.fillStyle = textOverlay.color;
saveContext.font = `${textOverlay.size}px Arial`;
saveContext.fillText(textOverlay.content, textOverlay.x, textOverlay.y);

  // Convert the canvas image to a data URL
  const dataURL = saveCanvas.toDataURL();

  // Prompt the user for a filename
  const filename = prompt("Save Image As :", "edited_image.png");

  // If the user clicked "Cancel", then don't download the file
  if (filename === null) {
    return;
  }
  const link = document.createElement("a");

  // Set the download filename to the user-entered filename
  link.download = filename; 

  // Create a temporary link element to trigger the download
  link.href = dataURL;
  link.click();
}

//Resetting filters and transformation applied
const resetButton = document.getElementById('resetButton');
resetButton.addEventListener('click', resetAllFilters);

function resetAllFilters() {
  resetSettings();
 
  // Reset flip values
  flipHorizontal = false;
  flipVertical = false;

  // Reset rotation angle
  rotationAngle = 0;

  // Reset crop variables
  startX = undefined;
  startY = undefined;
  endX = undefined;
  endY = undefined;
  isCropMode = false;

  // Reset text overlay values
   textOverlay = {
    content: "",
    color: "#000000",
    size: 12,
    x: 0,
    y: 0
  };
  
  renderImage();
}
