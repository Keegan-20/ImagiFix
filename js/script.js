//creating variables
const fileInput = document.querySelector("#imageFileInput");
const canvas = document.querySelector("#canvas");
const canvasContext = canvas.getContext("2d"); 
const brightnessInput = document.getElementById('brightness');//user inputs
const saturationInput = document.getElementById('saturation');
const contrastInput = document.getElementById('contrast');
const blurInput       = document.getElementById('blur');
const inversionInput  =  document.getElementById('inversion');

const settings ={}; // this empty object  will store all the user inputs for brightness,blur ,saturation etc.
let image = null; //will store the currently selected image by default when page load  the user has not selected an image so its Null

//reseting the filters
function resetSettings(){
    settings.brightness ="100";
    settings.saturation ="100";
    settings.contrast ="100";
    settings.blur ="0";
    settings.inversion ="0";
    //to restore to default values when we select a new image
    brightnessInput.value = settings.brightness;
    saturationInput.value =settings.saturation;
    contrastInput.value =settings.contrast;
    blurInput.value =settings.blur;
    inversionInput.value =settings.inversion;
}
//updating the settings
function updateSetting(key,value){
    if(!image){
        return alert("Please select an image !!"); 
    }

    settings[key] = value; //where key is brightness,blur,sat. etc and value is whatever the user gives input
    renderImage();
} 
  function generateFilter() {
    const {brightness, saturation,contrast, blur, inversion} = settings;
    return `brightness(${brightness}%) saturate(${saturation}%) contrast(${contrast}%) blur(${blur}px) invert(${inversion}%)`;
  }

 function renderImage(){
    canvas.width = image.width;
    canvas.height = image.height;
    canvasContext.filter= generateFilter();
    canvasContext.drawImage(image,0,0); 
 }

//updating and saving the values given by the user
brightnessInput.addEventListener("change",()=> updateSetting("brightness",brightnessInput.value));
saturationInput.addEventListener("change",()=> updateSetting("saturation",saturationInput.value));
contrastInput.addEventListener("change",()=> updateSetting("contrast",contrastInput.value));
blurInput.addEventListener("change",()=> updateSetting("blur",blurInput.value));
inversionInput.addEventListener("change",()=> updateSetting("inversion",inversionInput.value));

//selection of a file using fileInput element
fileInput.addEventListener("change", () => {
    image = new Image();

     image.addEventListener("load",() => {
          resetSettings();
          renderImage();
          
     });
 image.src = URL.createObjectURL(fileInput.files[0]);
});

resetSettings();

