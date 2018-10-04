<template>
    <div class="upload-container">
        <!--UPLOAD-->
        <form enctype="multipart/form-data" novalidate>
            <div class="el-upload el-upload--picture-card" style="width: 100%; padding=30px 20px">
                <input type="file" multiple
                      :name="uploadFieldName"
                      @change="filesChange({
                          fieldName: $event.target.name,
                          fileList: $event.target.files
                      });"
                      accept="image/*"
                      class="input-file">
                <div class="el-icon-plus"/>
            </div>
        </form>
    </div>
</template>

<script>
  export default {
    name: 'SelectFileToUpload',
    props: [
        "uploadFieldName"
    ],
    methods: {
        filesChange({fieldName, fileList}) {
            const formData = new FormData();

            if (!fileList.length) return;

            // append the files to FormData
            Array
            .from(Array(fileList.length).keys())
            .map(x => {
                formData.append(fieldName, fileList[x], fileList[x].name);
            });
            this.$emit('upload-request', {fileName: fileList[0].name, formData});
        }
    }
  }
</script>

<!-- SASS styling -->
<style lang='scss' scoped>
.upload-container {
    .input-file {
        opacity: 0; /* invisible but it's there! */
        width: calc(100% - 40px);
        height: 150px;
        position: absolute;
        left: 20px;
        cursor: pointer;
    }

    .el-upload--picture-card:hover {
        border-color: lightblue;
    }

    .dropbox p {
        font-size: 1.2em;
        text-align: center;
        padding: 50px 0;
    }
}
</style>
