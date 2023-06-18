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
//range input value
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

//reseting the filters
function resetSettings() {
    settings.brightness = "100";
    settings.saturation = "100";
    settings.contrast = "100";
    settings.blur = "0";
    settings.inversion = "0";
    settings.opacity = "100";
    //to restore to default values when we select a new image
    brightnessInput.value = settings.brightness;
    saturationInput.value = settings.saturation;
    contrastInput.value = settings.contrast;
    blurInput.value = settings.blur;
    inversionInput.value = settings.inversion;
    opacityInput.value = settings.opacity;

}

// dispalying range input values according to user input
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

//opacity filter 0 to 1
opacityInput.addEventListener("input", function () {
   let opacity = opacityInput.value / 100;
   opacityRangeValue.textContent = opacity;
});

//image placeholder preview
const imgPlaceholder = new Image();
imgPlaceholder.onload = function () {
    canvasContext.drawImage(imgPlaceholder, 0, 0, canvas.width, canvas.height);
};
imgPlaceholder.src = "./img/image-placeholder.svg";

//updating the settings
function updateSetting(key, value) {
    if (!image) {
        displayErrorMessage("Please select an image to begin editing!!");

        for (let i = 0; i < outputTags.length ; i++) {
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
function displayErrorMessage(message) {
    const errorMessage = document.getElementById("error-message");
    errorMessage.textContent = message;
}

// Clear any existing error message after selecting the image
fileInput.addEventListener("change", () => {
    displayErrorMessage(" ");
})
function renderImage() {
     //taking the maximum height and width depending on image, such that  entire image is dispalyed without getting cut off. 
    const maxDimension = Math.max(image.width, image.height);
    canvas.width = maxDimension;
    canvas.height = maxDimension;

    canvasContext.clearRect(0, 0, canvas.width, canvas.height);

    canvasContext.save();
    canvasContext.translate(canvas.width / 2, canvas.height / 2);
    canvasContext.rotate((rotationAngle * Math.PI) / 180);
    canvasContext.drawImage(image, -image.width / 2, -image.height / 2);
    canvasContext.restore();

    canvasContext.filter = generateFilter();    
    canvasContext.drawImage(canvas, 0, 0, canvas.width, canvas.height);
}

function generateFilter() {
    const { brightness, saturation, contrast,
        blur, inversion, opacity } = settings;
    return `brightness(${brightness}%) saturate(${saturation}%) contrast(${contrast}%) blur(${blur}px) invert(${inversion}%) opacity(${opacity}%)`;
}

//updating and saving the values given by the user
brightnessInput.addEventListener("change", () => updateSetting("brightness", brightnessInput.value));
saturationInput.addEventListener("change", () => updateSetting("saturation", saturationInput.value));
contrastInput.addEventListener("change", () => updateSetting("contrast", contrastInput.value));
blurInput.addEventListener("change", () => updateSetting("blur", blurInput.value));
inversionInput.addEventListener("change", () => updateSetting("inversion", inversionInput.value));
opacityInput.addEventListener("change", () => updateSetting("opacity", opacityInput.value));

//selection of a file using fileInput element
fileInput.addEventListener("change", () => {
    image = new Image();
    image.addEventListener("load", () => {

        resetSettings();
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
const tempCanvas = document.createElement('canvas');
const tempContext = tempCanvas.getContext('2d');
let rotationAngle = 0;

function rotateImage(angle) {
    if (!image) {
        return displayErrorMessage("Please select an image to begin editing!!");
    }

    rotationAngle += angle;
    //checking if rotatiom angle is within 0 to 359
    if (rotationAngle >= 360) {
        rotationAngle %= 360;
    } else if (rotationAngle < 0) {
        rotationAngle = (rotationAngle % 360) + 360;
    }


    tempCanvas.width = Math.max(image.width, image.height);
    tempCanvas.height = Math.max(image.width, image.height);

    tempContext.save();
    tempContext.translate(tempCanvas.width / 2, tempCanvas.height / 2); //endering context to the center of the canvas
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
