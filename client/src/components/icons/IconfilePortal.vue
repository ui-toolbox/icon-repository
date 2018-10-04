<template>
  <div class="iconfile-portal">
    <select-file-to-upload
        v-if="!hasImageUrl"
        @upload-request="uploadIconfile"/>
    <img v-if="hasImageUrl" :src="imageUrl"/>
  </div>
</template>

<script>
  import SelectFileToUpload from '@/components/icons/SelectFileToUpload'
  import { createIcon, ingestIconfile } from '@/services/icon';
  export default {
    props: [
      'iconName',
      'imageUrl'
    ],
    components: {
      "select-file-to-upload": SelectFileToUpload
    },
    computed: {
      hasImageUrl() {
        return typeof this.imageUrl !== 'undefined';
      }
    },
    methods: {
      onIconfileUploadSuccess(res, file) {
        console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> onIconfileUploadSuccess', res);
        this.$emit('iconfile-added', file);
      },
      beforeIconfileUpload(file) {
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>> beforeIconfileUpload", file.type);
        if (file.type !== 'image/png' && file.type !== 'image/svg+xml') {
          this.$showErrorMessage(`File type '${file.type}'not allowed`)
          return false;
        } else {
          return true;
        }
      },
      uploadIconfile({fileName, formData}) {
        let request;

        if (this.iconName) {
          request = ingestIconfile(this.iconName, formData);
        } else {
          formData.append("name", fileName.replace(/(.*)\.[^.]*$/, "$1"));
          request = createIcon(formData);
        }

        request.then(
            iconfileMetadata => {
              this.$showSuccessMessage('Icon-file added');
              this.$emit('iconfile-uploaded', iconfileMetadata);
            },
            error => this.$showErrorMessage(error)
        )
        .catch(error => this.$showErrorMessage(error));
      }
    }
  }
</script>

<style lang='scss' scoped>
  .el-upload {
    cursor: default;
  }
  .iconfile-uploader .el-upload {
    border: 1px dashed #d9d9d9;
    border-radius: 6px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
  }
  .iconfile-uploader .el-upload:hover {
    border-color: #409EFF;
  }
  .iconfile-uploader-icon {
    font-size: 28px;
    color: #8c939d;
    width: 178px;
    height: 178px;
    line-height: 178px;
    text-align: center;
  }
  .icon {
    width: 178px;
    height: 178px;
    display: block;
  }
  .el-upload-dragger {
    width: 180px;
  }
  .iconfile-portal img {
    display: block;
    margin: auto;
    height: 150px;
    widows: 150px;
  }
</style>
