<template>
    <div class="upload-container">
        <!--UPLOAD-->
        <form enctype="multipart/form-data" novalidate>
            <div class="dropbox">
                <input type="file" multiple
                      :name="uploadFieldName"
                      @change="$emit('change', {
                          fieldName: $event.target.name,
                          fileList: $event.target.files
                      });"
                      accept="image/*"
                      class="input-file">
                <p>
                    Drag the initial icon file here<br> or click to browse
                </p>
            </div>
        </form>
    </div>
</template>

<script>
  export default {
    name: 'SelectFileToUpload',
    props: [
        "uploadFieldName"
    ]
  }
</script>

<!-- SASS styling -->
<style lang="scss">
.upload-container {
    .dropbox {
        outline: 2px dashed grey; /* the dash box */
        outline-offset: -10px;
        background: lightcyan;
        color: dimgray;
        padding: 10px 10px;
        min-height: 200px; /* minimum height */
        position: relative;
        cursor: pointer;
    }

    .input-file {
        opacity: 0; /* invisible but it's there! */
        width: 100%;
        height: 200px;
        position: absolute;
        cursor: pointer;
    }

    .dropbox:hover {
        background: lightblue; /* when mouse over to the drop zone, change color */
    }

    .dropbox p {
        font-size: 1.2em;
        text-align: center;
        padding: 50px 0;
    }
}
</style>
